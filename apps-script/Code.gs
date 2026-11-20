/**
 * Rotaract Club Samborondón · Puente entre la página web y las hojas del club.
 *
 * Se pega en: hoja "Web · Rotaract Samborondón" → Extensiones → Apps Script.
 * Se publica como "Aplicación web" (Ejecutar como: Yo · Acceso: Cualquier usuario).
 * Pasos completos en docs/SETUP.md.
 *
 * Dos hojas:
 *  - WEB  (esta): Actividades web, Inscripciones, Donaciones, Mensajes, Configuración.
 *  - BASE (Base del club): Actividades, Socios, Aliados, Donaciones, Aspirantes.
 *
 * Base → Web: actividades, directiva (nombre y cargo) y aliados.
 * Web → Base: aspirantes (desde Mensajes) y donaciones validadas (desde Donaciones).
 *
 * Endpoints:
 *  - GET  ?action=site         → actividades, logros, aliados, directiva, cifras y datos bancarios
 *  - POST {action:"register"}  → inscripción con control de cupos
 *  - POST {action:"donate"}    → intención de donación + comprobante a Google Drive
 *  - POST {action:"contact"}   → mensaje (y aspirante en la Base si quiere unirse)
 *
 * Nunca envía a la web: responsables, notas, montos recaudados, correos o teléfonos.
 */

const WEB_ID = '1vShNAPLCpBmjQh412bGeFvU6xp9hg-ZT-QZN5cCfHOo';
const DEFAULT_BASE_ID = '1BCtoer8WI0_dlu2Em39qajubDY0WrLtI9XeL2yDC1Yw';

const WEB = {
  activities: 'Actividades web',
  registrations: 'Inscripciones',
  donations: 'Donaciones',
  messages: 'Mensajes',
  config: 'Configuración',
};
const BASE = {
  activities: 'Actividades',
  members: 'Socios',
  allies: 'Aliados',
  donations: 'Donaciones',
  applicants: 'Aspirantes',
};

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'application/pdf': 'pdf',
};
const CACHE_KEY = 'site-v2';
const CACHE_SECONDS = 60;

/* ------------------------------------------------------------------ */
/* Entradas HTTP                                                       */
/* ------------------------------------------------------------------ */

function doGet(e) {
  try {
    const cache = CacheService.getScriptCache();
    const hit = cache.get(CACHE_KEY);
    if (hit) return json_(JSON.parse(hit));
    const data = buildSite_();
    try { cache.put(CACHE_KEY, JSON.stringify(data), CACHE_SECONDS); } catch (_) {}
    return json_(data);
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: 'server' });
  }
}

function doPost(e) {
  let body;
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (_) {
    return json_({ ok: false, error: 'bad_request' });
  }
  // Campo trampa: los humanos no lo ven, los bots lo llenan.
  if (body.website) return json_({ ok: true });

  try {
    switch (body.action) {
      case 'register': return json_(register_(body));
      case 'donate': return json_(donate_(body));
      case 'contact': return json_(contact_(body));
      default: return json_({ ok: false, error: 'bad_request' });
    }
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: 'server' });
  }
}

/* ------------------------------------------------------------------ */
/* Lectura para la web                                                 */
/* ------------------------------------------------------------------ */

function buildSite_() {
  const web = web_();
  const config = readConfig_(web);
  const base = base_(config);
  const tz = web.getSpreadsheetTimeZone();
  const acts = readActivities_(web, base, tz);
  const today = todayIso_(tz);

  const upcoming = acts
    .filter(a => a.show && a.status !== 'Realizada' && a.status !== 'Cancelada')
    .filter(a => !a.date || a.date >= today || a.status === 'En curso')
    .sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'))
    .map(a => publicActivity_(a, today, config));

  const past = acts
    .filter(a => a.show && a.status === 'Realizada' && (a.summary.es || a.summary.en))
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .slice(0, 6)
    .map(a => ({
      id: a.id, title: a.title, summary: a.summary, date: a.date,
      place: a.place, type: a.type, image: a.image,
    }));

  return {
    ok: true,
    updated: new Date().toISOString(),
    upcoming,
    past,
    allies: readAllies_(base),
    board: readBoard_(base),
    stats: readStats_(acts),
    bank: {
      bank: config['Banco'] || '',
      type: config['Tipo de cuenta'] || '',
      number: config['Número de cuenta'] || '',
      holder: config['Titular'] || '',
      id: config['Cédula / RUC del titular'] || '',
    },
  };
}

function publicActivity_(a, today, config) {
  const capacity = a.capacity > 0 ? a.capacity : null;
  const remaining = capacity === null ? null : Math.max(0, capacity - a.registered);
  return {
    id: a.id,
    title: a.title,
    summary: a.summary,
    date: a.date,
    time: a.time,
    place: a.place,
    type: a.type,
    allies: a.allies,
    status: a.status,
    dateConfirmed: a.status === 'Confirmada' || a.status === 'En curso',
    capacity,
    remaining,
    canRegister: registrationOpen_(a, today, config) && remaining !== 0,
    acceptsDonations: a.donations,
    image: a.image,
  };
}

function registrationOpen_(a, today, config) {
  if (!a.show || !a.date) return false;
  if (a.status === 'Cancelada' || a.status === 'Realizada') return false;
  if (a.date < today) return false;
  const hours = Number(config['Fin de inscripciones (horas antes)']) || 0;
  if (hours > 0) {
    const start = new Date(a.date + 'T' + (a.time || '00:00') + ':00-05:00');
    if (Date.now() > start.getTime() - hours * 3600 * 1000) return false;
  }
  return true;
}

/** Une las actividades de la Base con los extras de "Actividades web" por ID. */
function readActivities_(web, base, tz) {
  const extras = readExtras_(web);
  const counts = countRegistrations_(web);

  const sh = base.getSheetByName(BASE.activities);
  const range = sh.getDataRange();
  const values = range.getValues();
  const shown = range.getDisplayValues();
  const head = values[0].map(h => String(h).trim());
  const exact = name => head.indexOf(name);
  const C = {
    id: exact('ID'),
    title: exact('Actividad'),
    date: exact('Fecha'),
    time: exact('Hora'),
    place: exact('Lugar'),
    type: exact('Tipo'),
    allies: exact('Aliados'),
    status: exact('Estado'),
    volunteers: exact('Voluntarios'),
    beneficiaries: exact('Beneficiarios'),
    hours: exact('Horas de voluntariado'),
    summary: exact('Resumen para la web'),
  };
  const get = (row, i) => (i >= 0 ? row[i] : '');

  const out = [];
  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    const id = String(get(row, C.id)).trim();
    const titleEs = String(get(row, C.title)).trim();
    if (!id || !titleEs) continue;
    const x = extras[id] || {};
    const rawDate = get(row, C.date);
    const date = rawDate instanceof Date ? Utilities.formatDate(rawDate, tz, 'yyyy-MM-dd') : parseDmy_(String(rawDate));
    out.push({
      id,
      title: { es: titleEs, en: x.titleEn || '' },
      summary: { es: String(get(row, C.summary)).trim(), en: x.summaryEn || '' },
      date,
      time: C.time >= 0 ? String(shown[r][C.time]).trim() : '',
      place: String(get(row, C.place)).trim(),
      type: String(get(row, C.type)).trim(),
      allies: String(get(row, C.allies)).trim(),
      status: String(get(row, C.status)).trim(),
      volunteers: Number(get(row, C.volunteers)) || 0,
      beneficiaries: Number(get(row, C.beneficiaries)) || 0,
      hours: Number(get(row, C.hours)) || 0,
      // Si la actividad no está en "Actividades web", se muestra sin cupos ni donaciones.
      show: x.show !== false,
      capacity: x.capacity || 0,
      registered: counts[id] || 0,
      donations: !!x.donations,
      image: x.image || '',
    });
  }
  return out;
}

function readExtras_(web) {
  const sh = web.getSheetByName(WEB.activities);
  const out = {};
  if (!sh) return out;
  const v = sh.getDataRange().getValues();
  const head = v[0].map(h => String(h).trim());
  const starts = name => head.findIndex(h => h.toLowerCase().startsWith(name.toLowerCase()));
  const C = {
    id: starts('ID'),
    show: starts('Mostrar en la web'),
    capacity: starts('Cupos'),
    donations: starts('Acepta donaciones'),
    titleEn: starts('Actividad (inglés)'),
    summaryEn: starts('Resumen para la web (inglés)'),
    image: starts('Imagen'),
  };
  v.slice(1).forEach(r => {
    const id = String(r[C.id] || '').trim();
    if (!id) return;
    out[id] = {
      show: String(r[C.show] || '').trim().toLowerCase() !== 'no',
      capacity: Number(r[C.capacity]) || 0,
      donations: /^s[ií]/i.test(String(r[C.donations] || '').trim()),
      titleEn: String(r[C.titleEn] || '').trim(),
      summaryEn: String(r[C.summaryEn] || '').trim(),
      image: safeUrl_(String(r[C.image] || '').trim()),
    };
  });
  return out;
}

function countRegistrations_(web) {
  const sh = web.getSheetByName(WEB.registrations);
  const counts = {};
  sh.getDataRange().getValues().slice(1).forEach(r => {
    const id = String(r[1]).trim();
    if (id) counts[id] = (counts[id] || 0) + 1;
  });
  return counts;
}

function readAllies_(base) {
  const sh = base.getSheetByName(BASE.allies);
  if (!sh) return [];
  const v = sh.getDataRange().getValues();
  const head = v[0].map(h => String(h).trim());
  const iName = head.indexOf('Nombre');
  const iType = head.indexOf('Tipo');
  const iIg = head.indexOf('Instagram');
  return v.slice(1)
    .filter(r => String(r[iName]).trim())
    .map(r => ({
      name: String(r[iName]).trim(),
      type: iType >= 0 ? String(r[iType]).trim() : '',
      instagram: iIg >= 0 ? String(r[iIg]).trim().replace(/^@/, '') : '',
    }));
}

function readBoard_(base) {
  const sh = base.getSheetByName(BASE.members);
  if (!sh) return [];
  const v = sh.getDataRange().getValues();
  const head = v[0].map(h => String(h).trim());
  const iName = head.indexOf('Nombre');
  const iRole = head.indexOf('Cargo');
  const iState = head.indexOf('Estado');
  return v.slice(1)
    .filter(r => String(r[iName]).trim() && String(r[iRole]).trim())
    .filter(r => !/^socio/i.test(String(r[iRole]).trim()))
    .filter(r => iState < 0 || String(r[iState]).trim() !== 'Inactivo')
    .map(r => ({ name: String(r[iName]).trim(), role: String(r[iRole]).trim() }));
}

function readStats_(acts) {
  const done = acts.filter(a => a.status === 'Realizada');
  return {
    activities: done.length,
    volunteers: done.reduce((s, a) => s + a.volunteers, 0),
    beneficiaries: done.reduce((s, a) => s + a.beneficiaries, 0),
    hours: done.reduce((s, a) => s + a.hours, 0),
  };
}

function readConfig_(web) {
  const sh = web.getSheetByName(WEB.config);
  const out = {};
  if (!sh) return out;
  sh.getDataRange().getDisplayValues().slice(1).forEach(r => {
    if (r[0]) out[String(r[0]).trim()] = String(r[1]).trim();
  });
  return out;
}

/* ------------------------------------------------------------------ */
/* Inscripción                                                         */
/* ------------------------------------------------------------------ */

function register_(b) {
  const name = clean_(b.name, 120);
  const email = clean_(b.email, 160).toLowerCase();
  const phone = clean_(b.phone, 40);
  const id = clean_(b.activityId, 40);
  if (!name || !isEmail_(email) || !id) return { ok: false, error: 'invalid' };

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return { ok: false, error: 'busy' };
  try {
    const web = web_();
    const config = readConfig_(web);
    const tz = web.getSpreadsheetTimeZone();
    const act = readActivities_(web, base_(config), tz).find(a => a.id === id);
    if (!act) return { ok: false, error: 'not_found' };
    if (!registrationOpen_(act, todayIso_(tz), config)) return { ok: false, error: 'closed' };

    const sh = web.getSheetByName(WEB.registrations);
    const taken = sh.getDataRange().getValues().slice(1).filter(r => String(r[1]) === id);
    if (taken.some(r => String(r[4]).toLowerCase() === email)) return { ok: false, error: 'duplicate' };
    if (act.capacity > 0 && taken.length >= act.capacity) return { ok: false, error: 'full' };

    sh.appendRow([new Date(), id, act.title.es, name, email, phone, '', '']);
    SpreadsheetApp.flush();
    CacheService.getScriptCache().remove(CACHE_KEY);

    const remaining = act.capacity > 0 ? act.capacity - taken.length - 1 : null;
    notify_(config,
      `Nueva inscripción: ${act.title.es}`,
      `${name} (${email}${phone ? ', ' + phone : ''}) se inscribió en "${act.title.es}".` +
      (remaining !== null ? `\nCupos restantes: ${remaining}.` : '') +
      `\n\nVer: ${web.getUrl()}#gid=${sh.getSheetId()}`);
    return { ok: true, remaining };
  } finally {
    lock.releaseLock();
  }
}

/* ------------------------------------------------------------------ */
/* Donación con comprobante                                            */
/* ------------------------------------------------------------------ */

function donate_(b) {
  const name = clean_(b.name, 120);
  const email = clean_(b.email, 160).toLowerCase();
  const phone = clean_(b.phone, 40);
  const amount = Math.round(Number(b.amount) * 100) / 100;
  const id = clean_(b.activityId, 40);
  const file = b.file || {};
  if (!name || !isEmail_(email) || !(amount > 0) || amount > 100000) return { ok: false, error: 'invalid' };

  const ext = ALLOWED_TYPES[String(file.type || '').toLowerCase()];
  if (!ext || !file.data) return { ok: false, error: 'file_type' };
  const bytes = Utilities.base64Decode(String(file.data));
  if (bytes.length > MAX_FILE_BYTES) return { ok: false, error: 'file_size' };

  const web = web_();
  const config = readConfig_(web);
  const tz = web.getSpreadsheetTimeZone();
  let destination = 'Donación general';
  let destId = '';
  if (id) {
    const act = readActivities_(web, base_(config), tz).find(a => a.id === id && a.donations);
    if (act) { destination = act.title.es; destId = act.id; }
  }

  const folder = receiptsFolder_(web);
  const stamp = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HHmm');
  const fileName = `${stamp} · ${name} · $${amount.toFixed(2)}.${ext}`;
  const saved = folder.createFile(Utilities.newBlob(bytes, file.type, fileName));

  const sh = web.getSheetByName(WEB.donations);
  sh.appendRow([new Date(), destId, destination, name, email, phone, amount, saved.getUrl(), 'Pendiente', '', '']);

  notify_(config,
    `Nueva donación por validar: $${amount.toFixed(2)}`,
    `${name} (${email}${phone ? ', ' + phone : ''}) reportó una donación de $${amount.toFixed(2)} para "${destination}".` +
    `\nComprobante: ${saved.getUrl()}` +
    `\n\nValídala en: ${web.getUrl()}#gid=${sh.getSheetId()} (cambia Estado a "Validada" y pasa sola a la Base).`);
  return { ok: true };
}

function receiptsFolder_(web) {
  const sh = web.getSheetByName(WEB.config);
  const rows = sh.getDataRange().getValues();
  const r = rows.findIndex(row => String(row[0]).trim() === 'Carpeta de comprobantes (ID)');
  const savedId = r >= 0 ? String(rows[r][1]).trim() : '';
  if (savedId) {
    try { return DriveApp.getFolderById(savedId); } catch (_) {}
  }
  const folder = DriveApp.createFolder('Comprobantes de donaciones (web) · Rotaract Samborondón');
  if (r >= 0) sh.getRange(r + 1, 2).setValue(folder.getId());
  else sh.appendRow(['Carpeta de comprobantes (ID)', folder.getId(), 'Lo llena solo el script. No lo cambies.']);
  return folder;
}

/* ------------------------------------------------------------------ */
/* Contacto                                                            */
/* ------------------------------------------------------------------ */

const REASONS = {
  join: 'Quiero ser parte del club',
  volunteer: 'Quiero ser voluntario/a',
  partner: 'Alianza o patrocinio',
  other: 'Otro',
};

function contact_(b) {
  const name = clean_(b.name, 120);
  const email = clean_(b.email, 160).toLowerCase();
  const phone = clean_(b.phone, 40);
  const instagram = clean_(String(b.instagram || '').trim().replace(/^@+/, ''), 60).replace(/^'/, '');
  const reason = REASONS[b.reason] || REASONS.other;
  const message = clean_(b.message, 3000, true);
  if (!name || !isEmail_(email) || !message) return { ok: false, error: 'invalid' };

  const web = web_();
  const config = readConfig_(web);
  let toBase = '';
  if (b.reason === 'join') {
    try {
      const ap = base_(config).getSheetByName(BASE.applicants);
      const age = Number(b.age) > 0 && Number(b.age) < 100 ? Number(b.age) : '';
      ap.appendRow([new Date(), name, age, phone, instagram ? '@' + instagram : '', email, 'Página web', '', 'Nuevo contacto', '', 'Mensaje desde la web: ' + message]);
      toBase = 'Sí';
    } catch (err) {
      console.error('No se pudo pasar a Aspirantes: ' + err);
      toBase = 'Error: revisar';
    }
  }
  web.getSheetByName(WEB.messages).appendRow([new Date(), name, email, phone, reason, message, 'Nuevo', toBase]);

  notify_(config,
    `Nuevo mensaje en la web: ${reason}`,
    `${name} (${email}${phone ? ', ' + phone : ''}) escribió:\n\n${message}` +
    (toBase === 'Sí' ? '\n\nSe agregó a Aspirantes en la Base del club.' : '') +
    `\n\nResponder a: ${email}`,
    email);
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Donación validada → Base (activador instalable, lo crea setup())    */
/* ------------------------------------------------------------------ */

function onDonationEdit(e) {
  if (!e || !e.range) return;
  const sh = e.range.getSheet();
  if (sh.getName() !== WEB.donations || e.range.getColumn() > 9 || e.range.getLastColumn() < 9) return;
  const web = e.source;
  const config = readConfig_(web);
  const first = Math.max(2, e.range.getRow());
  const last = e.range.getLastRow();
  if (last < first) return;
  const rows = sh.getRange(first, 1, last - first + 1, 11).getValues();
  const baseDonations = base_(config).getSheetByName(BASE.donations);
  let moved = 0;
  rows.forEach((v, i) => {
    if (String(v[8]) !== 'Validada' || String(v[9]) === 'Sí') return;
    baseDonations.appendRow([v[0], v[1], v[2], v[3], 'Persona', 'Dinero', v[6], '', '', 'Desde la web · ' + v[4] + ' · ' + v[7]]);
    sh.getRange(first + i, 10).setValue('Sí');
    moved++;
  });
  if (moved) web.toast(`${moved} donación(es) pasada(s) a Donaciones de la Base.`, 'Rotaract', 5);
}

/* ------------------------------------------------------------------ */
/* Configuración inicial (se corre a mano desde el editor)             */
/* ------------------------------------------------------------------ */

/**
 * Córrela una vez: pide permisos (hojas, Drive, correo), crea la carpeta de
 * comprobantes e instala el activador que pasa las donaciones validadas a la Base.
 */
function setup() {
  const web = web_();
  const folder = receiptsFolder_(web);
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'onDonationEdit')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('onDonationEdit').forSpreadsheet(web).onEdit().create();
  console.log('Carpeta de comprobantes: ' + folder.getUrl());
  console.log('Activador de donaciones instalado.');
  console.log(JSON.stringify(buildSite_(), null, 2));
}

/* ------------------------------------------------------------------ */
/* Utilidades                                                          */
/* ------------------------------------------------------------------ */

function web_() {
  return SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById(WEB_ID);
}

function base_(config) {
  const id = (config && config['ID de la Base del club']) || DEFAULT_BASE_ID;
  return SpreadsheetApp.openById(id);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function notify_(config, subject, body, replyTo) {
  const to = (config['Correo para avisos'] || '').trim();
  if (!to) return;
  try {
    const opts = { name: 'Web Rotaract Samborondón' };
    if (replyTo) opts.replyTo = replyTo;
    MailApp.sendEmail(to, '[Web] ' + subject, body, opts);
  } catch (err) {
    console.warn('No se pudo enviar el aviso: ' + err);
  }
}

function clean_(v, max, multiline) {
  // Quita espacios sobrantes y evita que un texto empiece con = + - @ (inyección de fórmulas).
  let s = String(v == null ? '' : v);
  s = multiline ? s.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n') : s.replace(/\s+/g, ' ');
  s = s.trim().slice(0, max);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}

function isEmail_(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
}

function safeUrl_(s) {
  return /^https:\/\//i.test(s) ? s : '';
}

function todayIso_(tz) {
  return Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
}

function parseDmy_(s) {
  const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}
