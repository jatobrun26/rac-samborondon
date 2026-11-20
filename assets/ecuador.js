/* Página "Conoce Ecuador": relojes del mundo y datos del club desde la hoja */
(function () {
  'use strict';

  const R = window.RAC;
  const CFG = window.RAC_CONFIG || {};
  const API = (CFG.apiUrl || '').trim();
  const HOME = 'America/Guayaquil';
  const CITIES = [
    ['ec.city.delhi', 'Asia/Kolkata'],
    ['ec.city.ny', 'America/New_York'],
    ['ec.city.sp', 'America/Sao_Paulo'],
    ['ec.city.madrid', 'Europe/Madrid'],
    ['ec.city.london', 'Europe/London'],
    ['ec.city.tokyo', 'Asia/Tokyo'],
  ];
  let site = null;

  /* ---------------- Relojes ---------------- */
  const locale = () => (R.lang === 'en' ? 'en-GB' : 'es-EC');
  const fmt = (tz, opts) => new Intl.DateTimeFormat(locale(), Object.assign({ timeZone: tz }, opts)).format(new Date());
  function offset(tz) { // minutos respecto a UTC
    const d = new Date();
    const o = {};
    new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' })
      .formatToParts(d).forEach(x => { o[x.type] = x.value; });
    return Math.round((Date.UTC(o.year, o.month - 1, o.day, o.hour, o.minute) - d.getTime()) / 900000) * 15;
  }
  function hm(m, sign) {
    const a = Math.abs(m), h = Math.floor(a / 60), r = a % 60;
    return (sign ? (m < 0 ? '−' : '+') : '') + h + (r ? ':' + String(r).padStart(2, '0') : '') + (sign ? ' h' : '');
  }
  const world = document.getElementById('world');
  const cityEls = CITIES.map(() => {
    const el = document.createElement('div');
    el.className = 'city';
    el.innerHTML = '<small></small><b>--:--</b><span></span>';
    world.appendChild(el);
    return el;
  });
  function tick() {
    const t = { hour: '2-digit', minute: '2-digit', hour12: false };
    const home = offset(HOME);
    document.getElementById('t-home').textContent = fmt(HOME, t);
    document.getElementById('d-home').textContent = fmt(HOME, { weekday: 'short', day: 'numeric', month: 'short' }) + ' · UTC' + (home < 0 ? '−' : '+') + hm(home);
    CITIES.forEach(([key, tz], i) => {
      const diff = offset(tz) - home;
      const el = cityEls[i];
      el.children[0].textContent = R.t(key);
      el.children[1].textContent = fmt(tz, t);
      el.children[2].textContent = diff === 0 ? R.t('ec.clock.same') : hm(diff, true);
    });
  }
  try { tick(); setInterval(tick, 15000); } catch (_) {}

  /* ---------------- Directiva y actividades (desde la hoja) ---------------- */
  const ROLE_EN = {
    'presidente/a': 'President', 'vicepresidente/a': 'Vice President', 'secretario/a': 'Secretary',
    'tesorero/a': 'Treasurer', 'macero/a': 'Sergeant-at-arms', 'past president': 'Past President',
  };
  const initials = name => name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  const fmtMonth = iso => {
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map(Number);
    return new Intl.DateTimeFormat(R.lang === 'en' ? 'en-US' : 'es-EC', { month: 'long', year: 'numeric' }).format(new Date(y, m - 1, d));
  };

  function render() {
    tick();
    if (!site) return;
    const board = site.board || [];
    document.getElementById('board-wrap').hidden = !board.length;
    document.getElementById('ec-board').innerHTML = board.map(p => {
      const role = R.lang === 'en' ? (ROLE_EN[p.role.toLowerCase()] || p.role) : p.role;
      return `<li><span class="avatar" aria-hidden="true">${R.esc(initials(p.name))}</span><div><b>${R.esc(p.name)}</b><small>${R.esc(role)}</small></div></li>`;
    }).join('');

    const past = (site.past || []).slice(0, 3);
    document.getElementById('recent-wrap').hidden = !past.length;
    document.getElementById('recent').innerHTML = past.map(a => `<li>
      <span class="when">${R.esc(fmtMonth(a.date))}</span>
      <h3>${R.esc(R.pick(a.title))}</h3>
      <p>${R.esc(R.pick(a.summary))}</p>
    </li>`).join('');
  }
  R.onLang(render);

  async function load() {
    const data = API
      ? await fetch(API + '?action=site', { cache: 'no-store' }).then(r => r.json()).catch(() => null)
      : window.RAC_DEMO;
    if (data && data.ok) { site = data; render(); }
  }

  R.start();
  load();
})();
