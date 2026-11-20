/* Rotaract Club Samborondón · código compartido por todas las páginas:
   idioma (ES/EN), tema claro/oscuro, menú móvil, barra al hacer scroll,
   animación de aparición y año del footer. */
(function () {
  'use strict';

  const root = document.documentElement;
  const DICT = window.RAC_I18N || { es: {}, en: {} };
  const listeners = [];
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (_) {} },
  };

  let lang = root.lang === 'en' ? 'en' : 'es';

  function t(key, vars) {
    let s = (DICT[lang] && DICT[lang][key]);
    if (s == null) s = DICT.es[key];
    if (s == null) s = key;
    if (vars) Object.keys(vars).forEach(k => { s = s.replace('{' + k + '}', vars[k]); });
    return s;
  }

  function apply() {
    root.lang = lang;
    const title = document.body.dataset.titleKey;
    if (title) document.title = t(title);
    const desc = document.body.dataset.descKey;
    const md = document.querySelector('meta[name="description"]');
    if (desc && md) md.setAttribute('content', t(desc));
    document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
    // Solo para textos propios con formato simple (<b>, <i>, <a>) definidos en los diccionarios.
    document.querySelectorAll('[data-i18n-html]').forEach(el => { el.innerHTML = t(el.dataset.i18nHtml); });
    document.querySelectorAll('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
    document.querySelectorAll('[data-i18n-alt]').forEach(el => { el.setAttribute('alt', t(el.dataset.i18nAlt)); });
    listeners.forEach(fn => { try { fn(lang); } catch (err) { console.error(err); } });
    observeReveal();
  }

  function setLang(next) {
    lang = next === 'en' ? 'en' : 'es';
    store.set('rac-lang', lang);
    apply();
  }

  /* Idioma */
  const langBtn = document.getElementById('lang');
  if (langBtn) langBtn.addEventListener('click', () => setLang(lang === 'es' ? 'en' : 'es'));

  /* Tema */
  const themeBtn = document.getElementById('theme');
  if (themeBtn) themeBtn.addEventListener('click', () => {
    const dark = root.dataset.theme
      ? root.dataset.theme === 'dark'
      : window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.dataset.theme = dark ? 'light' : 'dark';
    store.set('rac-theme', root.dataset.theme);
  });

  /* Menú móvil */
  const menu = document.getElementById('menu');
  const links = document.getElementById('links');
  if (menu && links) {
    menu.addEventListener('click', () => {
      const open = links.classList.toggle('open');
      menu.setAttribute('aria-expanded', String(open));
    });
    links.addEventListener('click', e => {
      if (e.target.closest('a')) { links.classList.remove('open'); menu.setAttribute('aria-expanded', 'false'); }
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && links.classList.contains('open')) { links.classList.remove('open'); menu.setAttribute('aria-expanded', 'false'); menu.focus(); }
    });
  }

  /* Borde de la barra al bajar */
  const nav = document.querySelector('.nav');
  if (nav) {
    const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* Enlace activo según la sección visible */
  if (links && 'IntersectionObserver' in window) {
    const map = {};
    links.querySelectorAll('a[href^="#"]').forEach(a => { map[a.getAttribute('href').slice(1)] = a; });
    const spy = new IntersectionObserver(entries => entries.forEach(en => {
      const a = map[en.target.dataset.nav || en.target.id];
      if (a && en.isIntersecting) {
        Object.values(map).forEach(x => x.classList.remove('active'));
        a.classList.add('active');
      }
    }), { rootMargin: '-45% 0px -50% 0px' });
    document.querySelectorAll('main section[id]').forEach(s => spy.observe(s));
  }

  /* Aparición al hacer scroll */
  const io = 'IntersectionObserver' in window
    ? new IntersectionObserver(entries => entries.forEach(en => {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      }), { rootMargin: '0px 0px -40px 0px' })
    : null;
  function observeReveal() {
    document.querySelectorAll('.reveal:not(.in)').forEach(el => { if (io) io.observe(el); else el.classList.add('in'); });
  }

  /* Año del footer */
  document.querySelectorAll('[data-year]').forEach(el => { el.textContent = new Date().getFullYear(); });

  window.RAC = {
    get lang() { return lang; },
    t,
    setLang,
    onLang(fn) { listeners.push(fn); },
    observeReveal,
    esc: s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
    pick: obj => (obj && (obj[lang] || obj.es || obj.en)) || '',
    start: apply,
  };
})();
