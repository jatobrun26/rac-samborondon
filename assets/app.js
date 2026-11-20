/* Rotaract Club Samborondón · lógica del sitio */
(function () {
  'use strict';

  const CFG = window.RAC_CONFIG || {};
  const API = (CFG.apiUrl || '').trim();
  const DEMO = !API;
  const MAX_FILE = 5 * 1024 * 1024;
  const R = window.RAC; // código compartido (assets/site.js)

  let lang = R.lang;
  let site = null; // datos de la hoja
  let siteError = false;

  /* ---------------- Utilidades ---------------- */
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const t = R.t;
  const esc = R.esc;
  const pick = R.pick;
  const parseIso = iso => {
    if (!iso) return null;
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
  };
  const fmtDate = (iso, opts) => {
    const d = parseIso(iso);
    return d ? new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'es-EC', opts).format(d) : '';
  };
  const initials = name => name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  const icon = {
    pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
    clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    users: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4-6"/></svg>',
    ig: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/></svg>',
  };

  /* ---------------- Idioma ---------------- */
  R.onLang(next => {
    lang = next;
    renderAll();
    // Mensajes de formulario visibles: se limpian para no quedar en otro idioma.
    $$('.form-msg').forEach(m => { if (!m.classList.contains('ok')) { m.textContent = ''; m.className = 'form-msg'; } });
  });

  /* ---------------- Datos ---------------- */
  async function loadSite() {
    if (DEMO) { site = window.RAC_DEMO; renderAll(); return; }
    try {
      const res = await fetch(API + '?action=site', { cache: 'no-store' });
      const data = await res.json();
      if (!data.ok) throw new Error('api');
      site = data;
      siteError = false;
    } catch (err) {
      console.error(err);
      siteError = true;
    }
    renderAll();
  }

  function renderAll() {
    renderStats();
    renderActivities();
    renderPast();
    renderAllies();
    renderBoard();
    renderBank();
    renderDonateOptions();
    observeReveal();
  }

  /* ---------------- Cifras ---------------- */
  function renderStats() {
    const el = $('#stats');
    const s = (site && site.stats) || {};
    const items = [[new Date().getFullYear() - 2020, t('stats.years')]];
    if (s.activities) items.push([s.activities, t('stats.activities')]);
    if (s.volunteers) items.push([s.volunteers, t('stats.volunteers')]);
    if (s.beneficiaries) items.push([s.beneficiaries, t('stats.beneficiaries')]);
    if (s.hours) items.push([s.hours, t('stats.hours')]);
    if (site && site.allies && site.allies.length) items.push([site.allies.length, t('stats.allies')]);
    items.push(['4400', t('stats.district')]);
    el.innerHTML = items.slice(0, 4).map(([n, l]) =>
      `<div class="stat"><b>${esc(typeof n === 'number' ? n.toLocaleString(lang) : n)}</b><small>${esc(l)}</small></div>`).join('');
  }

  /* ---------------- Próximas actividades ---------------- */
  function renderActivities() {
    const el = $('#acts');
    if (!site && !siteError) return; // sigue el esqueleto
    if (siteError) { el.innerHTML = `<p class="empty">${esc(t('acts.error'))} <a href="https://www.instagram.com/${esc(CFG.instagram)}/" target="_blank" rel="noopener">@${esc(CFG.instagram)}</a></p>`; return; }
    const list = site.upcoming || [];
    if (!list.length) { el.innerHTML = `<p class="empty">${esc(t('acts.empty'))}</p>`; return; }
    el.innerHTML = list.map((a, i) => activityCard(a, i)).join('');
  }

  function activityCard(a, i) {
    const d = parseIso(a.date);
    const tbc = !a.dateConfirmed;
    const ongoing = a.status === 'En curso';
    const full = a.remaining === 0;
    const chip = d
      ? `<div class="date-chip${tbc ? ' tbc' : ''}"><b>${d.getDate()}</b><small>${esc(fmtDate(a.date, { month: 'short' }).replace('.', ''))}</small></div>`
      : `<div class="date-chip tbc"><b>?</b><small>—</small></div>`;
    const tags = [];
    if (ongoing) tags.push(`<span class="tag live">${esc(t('acts.ongoing'))}</span>`);
    else if (tbc) tags.push(`<span class="tag warn">${esc(t('acts.tbc'))}</span>`);
    if (a.type) tags.push(`<span class="tag">${esc(tr(a.type))}</span>`);

    const meta = [];
    if (d) meta.push(`<span>${esc(fmtDate(a.date, { weekday: 'long', day: 'numeric', month: 'long' }))}</span>`);
    if (a.time) meta.push(`<span>${icon.clock}${esc(a.time)}</span>`);
    if (a.place) meta.push(`<span>${icon.pin}${esc(a.place)}</span>`);
    if (a.allies) meta.push(`<span>${icon.users}${esc(t('acts.with'))} ${esc(a.allies)}</span>`);

    let capacity = '';
    if (a.capacity) {
      const used = a.capacity - a.remaining;
      const pct = Math.min(100, Math.round((used / a.capacity) * 100));
      const label = full ? t('acts.full') : a.remaining === 1 ? t('acts.spot') : t('acts.spots', { n: a.remaining });
      capacity = `<div class="capacity"><div class="capacity-label"><b>${esc(label)}</b><span>${used}/${a.capacity}</span></div><div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="${a.capacity}" aria-valuenow="${used}" aria-label="${esc(label)}"><i style="width:${pct}%"></i></div></div>`;
    }

    const actions = [];
    if (a.canRegister) actions.push(`<button class="btn btn-primary" type="button" data-register="${esc(a.id)}">${esc(t('acts.register'))}</button>`);
    else if (!ongoing && (full || a.date)) actions.push(`<button class="btn btn-outline" type="button" disabled>${esc(full ? t('acts.full') : t('acts.closed'))}</button>`);
    if (a.acceptsDonations) actions.push(`<a class="btn ${a.canRegister ? 'btn-outline' : 'btn-primary'}" href="#dona" data-donate="${esc(a.id)}">${esc(t('acts.donate'))}</a>`);

    const summary = pick(a.summary);
    return `<article class="act reveal${full ? ' is-full' : ''}" style="--i:${i % 6}">
      ${a.image ? `<img class="act-img" src="${esc(a.image)}" alt="" loading="lazy">` : ''}
      <div class="act-body">
        <div class="act-top">${chip}<div><div class="tags">${tags.join('')}</div><h3 style="margin-top:8px">${esc(pick(a.title))}</h3></div></div>
        <div class="act-meta">${meta.join('')}</div>
        ${summary ? `<p class="act-summary">${esc(summary)}</p>` : ''}
        ${capacity}
        ${actions.length ? `<div class="act-actions">${actions.join('')}</div>` : ''}
      </div>
    </article>`;
  }

  /* ---------------- Impacto ---------------- */
  function renderPast() {
    const el = $('#past');
    const list = (site && site.past) || [];
    $('#impacto').hidden = !list.length && !(site && site.allies && site.allies.length);
    el.innerHTML = list.map((a, i) => `<article class="past-card reveal" style="--i:${i}">
      ${a.image ? `<img src="${esc(a.image)}" alt="" loading="lazy">` : ''}
      <span class="when">${esc(a.date ? fmtDate(a.date, { month: 'long', year: 'numeric' }) : tr(a.type || ''))}</span>
      <h3>${esc(pick(a.title))}</h3>
      <p>${esc(pick(a.summary))}</p>
    </article>`).join('');
  }

  function renderAllies() {
    const list = (site && site.allies) || [];
    $('#allies-block').hidden = !list.length;
    $('#allies').innerHTML = list.map(a => {
      const inner = `${esc(a.name)}${a.type ? ` <small>· ${esc(tr(a.type))}</small>` : ''}`;
      return a.instagram
        ? `<li><a href="https://www.instagram.com/${encodeURIComponent(a.instagram)}/" target="_blank" rel="noopener">${icon.ig}${inner}</a></li>`
        : `<li><span>${inner}</span></li>`;
    }).join('');
  }

  const TYPE_EN = {
    'servicio': 'Service', 'compañerismo': 'Fellowship', 'recaudación de fondos': 'Fundraising',
    'desarrollo profesional': 'Professional development', 'capacitación': 'Training', 'fundación': 'Foundation',
    'institución de salud': 'Health institution', 'club rotaract': 'Rotaract club', 'club rotary': 'Rotary club',
    'club interact': 'Interact club', 'organización social': 'Social organization', 'empresa': 'Company',
  };
  const tr = s => (lang === 'en' && s && TYPE_EN[s.toLowerCase()]) || s;

  /* ---------------- Directiva ---------------- */
  const ROLE_EN = {
    'presidente/a': 'President', 'presidente': 'President', 'presidenta': 'President',
    'vicepresidente/a': 'Vice President', 'vicepresidente': 'Vice President', 'vicepresidenta': 'Vice President',
    'secretario/a': 'Secretary', 'secretario': 'Secretary', 'secretaria': 'Secretary',
    'tesorero/a': 'Treasurer', 'tesorero': 'Treasurer', 'tesorera': 'Treasurer',
    'past president': 'Past President', 'macero/a': 'Sergeant-at-arms',
    'director/a de imagen pública': 'Public Image Director', 'director/a de servicio': 'Service Director',
  };
  function renderBoard() {
    const list = (site && site.board) || [];
    $('#board-card').hidden = !list.length;
    $('#board').innerHTML = list.map(p => {
      const role = lang === 'en' ? (ROLE_EN[p.role.toLowerCase()] || p.role) : p.role;
      return `<li><span class="avatar" aria-hidden="true">${esc(initials(p.name))}</span><div><b>${esc(p.name)}</b><small>${esc(role)}</small></div></li>`;
    }).join('');
  }

  /* ---------------- Cuenta bancaria ---------------- */
  function renderBank() {
    const el = $('#bank');
    const b = (site && site.bank) || {};
    const rows = [['donate.bank', b.bank], ['donate.type', b.type], ['donate.number', b.number], ['donate.holder', b.holder], ['donate.id', b.id]].filter(r => r[1]);
    if (!rows.length) {
      el.innerHTML = `<h3>${esc(t('donate.step1'))}</h3><p class="bank-empty">${esc(t('donate.nobank'))} <a href="mailto:${esc(CFG.email)}">${esc(CFG.email)}</a></p>`;
      return;
    }
    el.innerHTML = `<h3>${esc(t('donate.step1'))}</h3>` + rows.map(([k, v]) => `<div class="bank-row"><div><small>${esc(t(k))}</small><b>${esc(v)}</b></div>${k === 'donate.number' || k === 'donate.id' ? `<button class="copy-btn" type="button" data-copy="${esc(v)}">${esc(t('donate.copy'))}</button>` : ''}</div>`).join('');
  }
  document.addEventListener('click', async e => {
    const btn = e.target.closest('[data-copy]');
    if (!btn) return;
    try { await navigator.clipboard.writeText(btn.dataset.copy); btn.textContent = t('donate.copied'); setTimeout(() => { btn.textContent = t('donate.copy'); }, 1600); } catch (_) {}
  });

  function renderDonateOptions() {
    const sel = $('#donate-dest');
    const current = sel.value;
    const list = ((site && site.upcoming) || []).filter(a => a.acceptsDonations);
    sel.innerHTML = `<option value="">${esc(t('donate.general'))}</option>` + list.map(a => `<option value="${esc(a.id)}">${esc(pick(a.title))}</option>`).join('');
    if (list.some(a => a.id === current)) sel.value = current;
  }
  document.addEventListener('click', e => {
    const a = e.target.closest('[data-donate]');
    if (a) $('#donate-dest').value = a.dataset.donate;
  });

  /* ---------------- Envío a la hoja ---------------- */
  async function send(payload) {
    if (DEMO) { await new Promise(r => setTimeout(r, 600)); return { ok: true, demo: true }; }
    try {
      // text/plain evita la verificación CORS previa que Apps Script no admite.
      const res = await fetch(API, { method: 'POST', body: JSON.stringify(payload), headers: { 'Content-Type': 'text/plain;charset=utf-8' } });
      return await res.json();
    } catch (err) {
      console.error(err);
      return { ok: false, error: 'network' };
    }
  }

  function formData(form) {
    const out = {};
    new FormData(form).forEach((v, k) => { if (typeof v === 'string') out[k] = v.trim(); });
    return out;
  }

  function validate(form, extra) {
    let ok = true;
    $$('[required]', form).forEach(inp => {
      const field = inp.closest('.field');
      const bad = inp.type === 'file' ? !inp.files.length : !inp.value.trim() || !inp.checkValidity();
      field && field.classList.toggle('invalid', bad);
      if (bad) ok = false;
    });
    if (extra && !extra()) ok = false;
    return ok;
  }

  function setMsg(form, kind, text) {
    const m = $('.form-msg', form);
    m.className = 'form-msg ' + kind;
    m.textContent = text;
  }

  async function submitWith(form, buildPayload, onOk) {
    const btn = $('button[type="submit"]', form);
    const label = btn.textContent;
    setMsg(form, '', '');
    if (!validate(form)) { setMsg(form, 'err', t('form.required')); return; }
    btn.disabled = true;
    btn.textContent = t('form.sending');
    try {
      const payload = await buildPayload();
      if (!payload) return;
      const res = await send(payload);
      if (res.ok) {
        onOk(res);
        if (res.demo) setMsg(form, 'info', t('form.demo'));
      } else {
        setMsg(form, 'err', t('err.' + (res.error || 'server')));
        if (res.error === 'full' || res.error === 'closed') loadSite();
      }
    } finally {
      btn.disabled = false;
      btn.textContent = label;
    }
  }

  // Quita el rojo al corregir un campo.
  document.addEventListener('input', e => {
    const f = e.target.closest('.field.invalid');
    if (f) f.classList.remove('invalid');
  });

  /* ---------------- Inscripción ---------------- */
  const modal = $('#reg-modal');
  const regForm = $('#reg-form');
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-register]');
    if (!b || !site) return;
    const a = site.upcoming.find(x => x.id === b.dataset.register);
    if (!a) return;
    regForm.reset();
    setMsg(regForm, '', '');
    regForm.hidden = false;
    $$('.field', regForm).forEach(f => f.classList.remove('invalid'));
    $('button[type="submit"]', regForm).hidden = false;
    regForm.elements.activityId.value = a.id;
    $('#reg-title').textContent = pick(a.title);
    const bits = [];
    if (a.date) bits.push(fmtDate(a.date, { weekday: 'long', day: 'numeric', month: 'long' }) + (a.dateConfirmed ? '' : ` (${t('acts.tbc').toLowerCase()})`));
    if (a.time) bits.push(a.time);
    if (a.place) bits.push(a.place);
    $('#reg-meta').textContent = bits.join(' · ');
    if (typeof modal.showModal === 'function') modal.showModal(); else modal.setAttribute('open', '');
    setTimeout(() => regForm.elements.name.focus(), 50);
  });
  modal.addEventListener('click', e => {
    if (e.target === modal || e.target.closest('[data-close]')) modal.close();
  });
  regForm.addEventListener('submit', e => {
    e.preventDefault();
    submitWith(regForm, () => ({ action: 'register', ...formData(regForm) }), res => {
      setMsg(regForm, 'ok', t('reg.ok'));
      $('button[type="submit"]', regForm).hidden = true;
      if (!res.demo) loadSite();
    });
  });

  /* ---------------- Donación ---------------- */
  const donateForm = $('#donate-form');
  const fileInput = donateForm.elements.file;
  const fileBox = $('.file-box', donateForm);
  fileInput.addEventListener('change', () => {
    const f = fileInput.files[0];
    $('.file-name', fileBox).textContent = f ? f.name : t('donate.receiptDrop');
    fileBox.classList.toggle('has-file', !!f);
  });
  const readBase64 = file => new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1]);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
  donateForm.addEventListener('submit', e => {
    e.preventDefault();
    submitWith(donateForm, async () => {
      const f = fileInput.files[0];
      const type = (f.type || (/\.pdf$/i.test(f.name) ? 'application/pdf' : '')).toLowerCase();
      if (!/^(image\/(jpeg|png|webp|heic)|application\/pdf)$/.test(type)) { setMsg(donateForm, 'err', t('err.file_type')); return null; }
      if (f.size > MAX_FILE) { setMsg(donateForm, 'err', t('err.file_size')); return null; }
      const data = formData(donateForm);
      return { action: 'donate', ...data, file: { name: f.name, type, data: await readBase64(f) } };
    }, () => {
      donateForm.reset();
      fileBox.classList.remove('has-file');
      $('.file-name', fileBox).textContent = t('donate.receiptDrop');
      setMsg(donateForm, 'ok', t('donate.ok'));
    });
  });

  /* ---------------- Contacto ---------------- */
  const contactForm = $('#contact-form');
  const syncReason = () => { contactForm.dataset.reason = (contactForm.querySelector('input[name="reason"]:checked') || {}).value || 'other'; };
  contactForm.addEventListener('change', syncReason);
  syncReason();
  contactForm.addEventListener('submit', e => {
    e.preventDefault();
    submitWith(contactForm, () => ({ action: 'contact', ...formData(contactForm) }), () => {
      contactForm.reset();
      syncReason();
      setMsg(contactForm, 'ok', t('contact.ok'));
    });
  });

  const observeReveal = R.observeReveal;

  /* ---------------- Inicio ---------------- */
  R.start();
  loadSite();
})();
