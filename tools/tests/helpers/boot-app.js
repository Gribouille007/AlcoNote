// Harnais d'intégration : boote la VRAIE app compilée sous jsdom + IndexedDB
// en mémoire (fake-indexeddb), transport de partage mock par défaut. Hérite
// du pattern de l'ancien tools/smoke-test.js.
//
// IMPORTANT : appeler `ctx.cleanup()` dans le `after()` de CHAQUE fichier de
// test — la fermeture de la fenêtre jsdom purge les intervalles du realm
// (tick BAC 60 s, tick amis, pull partagé, TTL toast), sans quoi le process
// `node --test` ne se termine jamais.
'use strict';

// Le scheduler de react-dom garde un port MessageChannel écouté en permanence,
// ce qui maintiendrait le process Node en vie après les tests. On unref() les
// ports AVANT que `scheduler` ne soit requis : les messages continuent d'être
// délivrés tant que le process tourne, mais ils ne le retiennent plus.
const RealMC = global.MessageChannel;
if (RealMC && !RealMC.__alcoUnref) {
  global.MessageChannel = class extends RealMC {
    constructor() {
      super();
      if (this.port1.unref) this.port1.unref();
      if (this.port2.unref) this.port2.unref();
    }
  };
  global.MessageChannel.__alcoUnref = true;
}

require('fake-indexeddb/auto');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..', '..', '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Ordre d'index.html (sans React/Dexie/CDN ni js/share-config.js : le
// transport est forcé via window.SHARE_CONFIG pour rester déterministe).
const SCRIPTS = [
  'js/database.js',
  'js/scanner/product-lookup.js',
  'js/scanner/camera-scanner.js',
  'proto/dist/shared.js',
  'proto/dist/data.js',
  'proto/dist/stats-charts.js',
  'proto/dist/categories.js',
  'proto/dist/history.js',
  'proto/dist/stats.js',
  'proto/dist/share.js',
  'proto/dist/friends.js',
  'proto/dist/modals.js',
  'proto/dist/app.js',
];

async function bootApp({ preSeed, shareConfig } = {}) {
  const Dexie = require('dexie');
  // Pré-seed éventuel (ex. base v4 pour tester la migration v5) AVANT que
  // js/database.js n'ouvre la base.
  if (preSeed) await preSeed(Dexie);

  const dom = new JSDOM(
    '<!DOCTYPE html><html><body><div id="root"></div><div id="alco-splash">AlcoNote</div></body></html>',
    {
      url: 'http://localhost/', pretendToBeVisual: true,
      // outside-only : on évalue les scripts nous-mêmes via window.eval()
      // (les globaux window.* se résolvent en identifiants nus dans le realm
      // jsdom), sans exécution automatique de <script>.
      runScripts: 'outside-only',
    }
  );
  const { window } = dom;
  // Node ≥ 21 expose navigator & co en getters natifs : redéfinir proprement.
  const defineGlobal = (name, value) =>
    Object.defineProperty(global, name, { value, configurable: true, writable: true });
  defineGlobal('window', window);
  defineGlobal('document', window.document);
  defineGlobal('navigator', window.navigator);
  defineGlobal('location', window.location);
  global.IS_REACT_ACT_ENVIRONMENT = true;
  window.IS_REACT_ACT_ENVIRONMENT = true;

  // Shims navigateur absents de jsdom.
  window.matchMedia = window.matchMedia || (() => ({
    matches: false, media: '', addEventListener() {}, removeEventListener() {},
    addListener() {}, removeListener() {}, dispatchEvent() { return false; },
  }));
  class NoopObs { observe() {} unobserve() {} disconnect() {} }
  window.ResizeObserver = window.ResizeObserver || NoopObs;
  window.IntersectionObserver = window.IntersectionObserver || NoopObs;
  if (!window.requestAnimationFrame) window.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
  if (!window.cancelAnimationFrame) window.cancelAnimationFrame = (id) => clearTimeout(id);
  if (!window.crypto) {
    Object.defineProperty(window, 'crypto', { value: global.crypto, configurable: true });
  }
  window.fetch = () => Promise.reject(new Error('no network in test'));
  window.scrollTo = () => {};
  // Export de données (blob) + copie du code d'invitation.
  if (!window.URL.createObjectURL) window.URL.createObjectURL = () => 'blob:mock';
  if (!window.URL.revokeObjectURL) window.URL.revokeObjectURL = () => {};
  if (!window.navigator.clipboard) {
    Object.defineProperty(window.navigator, 'clipboard', {
      value: { writeText: async () => {} }, configurable: true,
    });
  }

  // Dexie + React/ReactDOM en globaux (équivalent des <script> UMD).
  window.Dexie = Dexie;
  window.React = require('react');
  const RD = require('react-dom');
  const { createRoot } = require('react-dom/client');
  window.ReactDOM = Object.assign({}, RD, { createRoot });

  // Transport mock par défaut : déterministe et hors-ligne.
  window.SHARE_CONFIG = Object.assign(
    { TRANSPORT: 'mock', SUPABASE_URL: '', SUPABASE_ANON_KEY: '', PULL_INTERVAL_MS: 600000 },
    shareConfig || {}
  );

  for (const s of SCRIPTS) {
    try { window.eval(read(s)); }
    catch (e) { e.message = `Eval failed in ${s}: ${e.message}`; throw e; }
  }

  const React = window.React;
  // React 18.3 expose React.act ; le fallback test-utils couvre d'anciennes
  // versions sans déclencher le warning de dépréciation quand act existe.
  const act = React.act || require('react-dom/test-utils').act;
  const flush = (ms = 250) => act(async () => { await sleep(ms); });

  const ctx = {
    window,
    document: window.document,
    act,
    flush,
    sleep,
    text: () => window.document.body.textContent || '',
    q: (sel) => window.document.querySelector(sel),
    qa: (sel) => [...window.document.querySelectorAll(sel)],
    tabs: () => [...window.document.querySelectorAll('[role="tab"]')],
    buttons: () => [...window.document.querySelectorAll('button')],
    click: (el) => el.dispatchEvent(new window.MouseEvent('click', { bubbles: true })),
    // Trouve un élément cliquable par son aria-label (regex), clique, attend.
    async clickAria(re, ms = 200) {
      const el = [...window.document.querySelectorAll('button, [role="tab"], [role="button"], [role="radio"]')]
        .find((b) => re.test(b.getAttribute('aria-label') || ''));
      if (!el) throw new Error(`clickAria: aucun élément avec aria-label ${re}`);
      await act(async () => { ctx.click(el); await sleep(ms); });
      return el;
    },
    // Trouve un bouton par son texte (regex), clique, attend.
    async clickText(re, ms = 200) {
      const el = [...window.document.querySelectorAll('button')]
        .find((b) => re.test(b.textContent || ''));
      if (!el) throw new Error(`clickText: aucun bouton avec le texte ${re}`);
      await act(async () => { ctx.click(el); await sleep(ms); });
      return el;
    },
    // QuickAddButton (« + ») écoute les pointer events, pas click.
    async pointerTap(el, ms = 200) {
      await act(async () => {
        el.dispatchEvent(new window.MouseEvent('pointerdown', { bubbles: true }));
        el.dispatchEvent(new window.MouseEvent('pointerup', { bubbles: true }));
        await sleep(ms);
      });
    },
    // Saisie dans un input contrôlé React (setter natif + event 'input').
    async setInput(input, value, ms = 60) {
      await act(async () => {
        const proto = input.tagName === 'TEXTAREA'
          ? window.HTMLTextAreaElement.prototype
          : window.HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto, 'value').set.call(input, value);
        input.dispatchEvent(new window.Event('input', { bubbles: true }));
        await sleep(ms);
      });
    },
    async blurInput(input, ms = 120) {
      await act(async () => {
        // React 18 mappe onBlur sur l'événement natif focusout (qui bulle).
        input.dispatchEvent(new window.FocusEvent('focusout', { bubbles: true }));
        input.dispatchEvent(new window.FocusEvent('blur'));
        await sleep(ms);
      });
    },
    findInputByAria(re) {
      return [...window.document.querySelectorAll('input')]
        .find((i) => re.test(i.getAttribute('aria-label') || ''));
    },
    // Polle un prédicat en laissant React/IndexedDB avancer entre deux
    // tentatives — plus robuste qu'un sleep fixe (CI lente, seed async…).
    async waitFor(predicate, { timeout = 5000, step = 100, label = 'waitFor' } = {}) {
      const deadline = Date.now() + timeout;
      for (;;) {
        const v = predicate();
        if (v) return v;
        if (Date.now() > deadline) throw new Error(`${label}: condition jamais vraie après ${timeout} ms`);
        await flush(step);
      }
    },
    cleanup: () => { try { dom.window.close(); } catch (e) { /* déjà fermée */ } },
  };

  // Laisse le mount + les effets + la migration + les chargements initiaux
  // (dont le seed des catégories par défaut) se faire avant de rendre la main.
  await flush(400);
  await ctx.waitFor(
    () => window.document.getElementById('root').children.length > 0,
    { label: 'boot: app montée' }
  );
  return ctx;
}

module.exports = { bootApp, SCRIPTS, ROOT, sleep };
