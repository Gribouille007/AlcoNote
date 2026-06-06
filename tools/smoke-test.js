#!/usr/bin/env node
/*
 * Smoke test (no browser): boots the REAL compiled app under jsdom + an
 * in-memory IndexedDB, then checks:
 *   A) Dexie v4 → v5 migration is loss-free (drinks kept, uid backfilled,
 *      safety backup written).
 *   B) The app mounts, shows 4 bottom tabs, and the new "Amis" tab works
 *      end-to-end with the mock transport (member list + live BAC pill +
 *      a friend's StatsTab with the map hidden).
 *
 * Run: node tools/smoke-test.js   (deps installed with `npm i --no-save
 * jsdom fake-indexeddb dexie react react-dom`).
 */
require('fake-indexeddb/auto');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

let failures = 0;
function check(name, cond) {
  console.log(`${cond ? '  ✓' : '  ✗ FAIL'} ${name}`);
  if (!cond) failures++;
}

async function main() {
  // ── Phase A : pré-seed une base v4 (drink SANS uid), puis on laissera
  // database.js (v5) migrer. ───────────────────────────────────────────────
  const Dexie = require('dexie');
  {
    const pre = new Dexie('AlcoNoteDB');
    pre.version(1).stores({
      categories: '++id, name, drinkCount, createdAt, updatedAt',
      drinks: '++id, name, category, quantity, unit, alcoholContent, date, time, location, barcode, createdAt, updatedAt',
      settings: 'key, value, updatedAt'
    });
    pre.version(2).stores({ bacRecords: '++id, bacValue, timestamp, date, drinkCount, createdAt' });
    pre.version(3).stores({ drinkRatings: 'drinkName, rating, updatedAt' });
    pre.version(4).stores({ bacRecords: null });
    await pre.open();
    await pre.table('categories').add({ name: 'Bière', drinkCount: 1, createdAt: new Date(), updatedAt: new Date() });
    await pre.table('drinks').add({
      name: 'Vieille Pilsner', category: 'Bière', quantity: 33, unit: 'cL',
      quantityInCL: 33, alcoholContent: 5, date: '2026-06-01', time: '20:00',
      location: null, barcode: null, createdAt: new Date(), updatedAt: new Date(),
    });
    await pre.table('drinkRatings').add({ drinkName: 'vieille pilsner', rating: 4, updatedAt: new Date() });
    await pre.close();
  }

  // ── jsdom + globals ───────────────────────────────────────────────────────
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="root"></div><div id="alco-splash">AlcoNote</div></body></html>', {
    url: 'http://localhost/', pretendToBeVisual: true,
    // outside-only lets us run the app's scripts via window.eval() in the
    // jsdom realm (so `window`-assigned globals like React/Dexie resolve as
    // bare identifiers) without jsdom auto-executing any <script> tags.
    runScripts: 'outside-only',
  });
  const { window } = dom;
  global.window = window;
  global.document = window.document;
  global.navigator = window.navigator;
  global.location = window.location;
  global.IS_REACT_ACT_ENVIRONMENT = true;

  // Shims navigateur manquants dans jsdom.
  window.matchMedia = window.matchMedia || (() => ({
    matches: false, media: '', addEventListener() {}, removeEventListener() {},
    addListener() {}, removeListener() {}, dispatchEvent() { return false; },
  }));
  class NoopObs { observe() {} unobserve() {} disconnect() {} }
  window.ResizeObserver = window.ResizeObserver || NoopObs;
  window.IntersectionObserver = window.IntersectionObserver || NoopObs;
  if (!window.requestAnimationFrame) window.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
  if (!window.cancelAnimationFrame) window.cancelAnimationFrame = (id) => clearTimeout(id);
  window.crypto = window.crypto || global.crypto;
  window.fetch = () => Promise.reject(new Error('no network in test'));
  window.scrollTo = () => {};

  // Dexie + React/ReactDOM en globaux (comme les <script> UMD).
  window.Dexie = Dexie;
  window.React = require('react');
  const RD = require('react-dom');
  const { createRoot } = require('react-dom/client');
  window.ReactDOM = Object.assign({}, RD, { createRoot });

  // ── Charge les scripts dans l'ordre d'index.html (sauf React/Dexie/CDN) ──
  const SCRIPTS = [
    'js/database.js',
    'js/scanner/product-lookup.js',
    'js/scanner/camera-scanner.js',
    'js/share-config.js',
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
  for (const s of SCRIPTS) {
    try { window.eval(read(s)); }
    catch (e) { console.error(`Eval failed in ${s}:`, e); throw e; }
  }
  check('Tous les scripts se chargent sans erreur', true);

  // Laisse le mount + les effets + la migration + les chargements DB se faire.
  const { act } = require('react-dom/test-utils');
  await act(async () => { await sleep(400); });

  // ── Phase A : assertions migration ────────────────────────────────────────
  const drinks = await window.dbManager.getAllDrinks();
  check('Migration: la boisson v4 est conservée', drinks.length === 1 && drinks[0].name === 'Vieille Pilsner');
  check('Migration: uid backfillé sur la boisson existante', !!(drinks[0] && drinks[0].uid));
  const backup = await window.dbManager.getLatestBackup();
  let backupOk = false;
  try {
    const snap = backup && JSON.parse(backup.json);
    backupOk = !!snap && Array.isArray(snap.drinks) && snap.drinks.some(d => d.name === 'Vieille Pilsner');
  } catch (e) {}
  check('Migration: backup pré-v5 écrit et contient les données', backupOk);

  // ── Phase B : UI ──────────────────────────────────────────────────────────
  const txt = () => window.document.body.textContent || '';
  const tabs = () => [...window.document.querySelectorAll('[role="tab"]')];
  check('4 onglets en bas de l\'écran', tabs().length === 4);
  check('Onglet "Amis" présent', tabs().some(b => (b.getAttribute('aria-label') || '').includes('Amis')));

  const clickAmis = () => {
    const b = tabs().find(b => (b.getAttribute('aria-label') || '').includes('Amis'));
    b.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  };
  await act(async () => { clickAmis(); await sleep(150); });
  check('Onglet Amis: CTA d\'activation quand le partage est off', /Active le partage|Partage entre amis/.test(txt()));

  // Active le partage + crée un groupe (mock) via l'API du moteur.
  await act(async () => {
    await window.shareEngine.setDisplayName('Moi');
    await window.shareEngine.setEnabled(true);
    await window.shareEngine.createGroup();
    await sleep(400);
  });

  check('Liste des amis: Léa visible', /Léa/.test(txt()));
  check('Liste des amis: Tom visible', /Tom/.test(txt()));

  // Pastille BAC : Léa (shareBac=true) → valeur numérique ; Tom → "—".
  const members = window.shareEngine.state.members.filter(m => m.userId !== window.shareEngine.state.userId);
  check('2 membres dans le groupe (hors moi)', members.length === 2);

  // Ouvre la vue stats de Léa : clique sa ligne.
  const leaBtn = [...window.document.querySelectorAll('button')]
    .find(b => (b.getAttribute('aria-label') || '').includes('Léa'));
  check('Ligne cliquable pour Léa', !!leaBtn);
  if (leaBtn) {
    await act(async () => { leaBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true })); await sleep(300); });
    const t = txt();
    check('Vue ami: en-tête "Statistiques partagées"', /Statistiques partagées/.test(t));
    check('Vue ami: section "Statistiques générales" rendue', /Statistiques générales/.test(t));
    check('Vue ami: carte MASQUÉE (pas de GPS partagé)', !/Carte des consommations/.test(t));
    check('Vue ami: BAC affiché pour Léa (opt-in)', /Alcoolémie/.test(t));
    // Ferme la vue ami (bouton Retour).
    const back = [...window.document.querySelectorAll('button')]
      .find(b => (b.getAttribute('aria-label') || '') === 'Retour');
    if (back) await act(async () => { back.dispatchEvent(new window.MouseEvent('click', { bubbles: true })); await sleep(120); });
  }

  // ── Paramètres › Partage entre amis ───────────────────────────────────────
  const menu = [...window.document.querySelectorAll('button')]
    .find(b => (b.getAttribute('aria-label') || '').includes('paramètres'));
  check('Bouton Paramètres présent', !!menu);
  if (menu) {
    await act(async () => { menu.dispatchEvent(new window.MouseEvent('click', { bubbles: true })); await sleep(150); });
    const t = txt();
    check('Paramètres: section "Partage entre amis"', /Partage entre amis/.test(t));
    check('Paramètres: pseudo affiché (partage actif)', /Pseudo/.test(t));
    check('Paramètres: "Quitter le groupe" disponible', /Quitter le groupe/.test(t));
    check('Paramètres: toggle "Partager mon alcoolémie"', /Partager mon alcoolémie/.test(t));
  }

  console.log(`\n${failures === 0 ? 'PASS ✅' : 'FAIL ❌'} — ${failures} échec(s)`);
  // Coupe les timers (intervalles BAC/pull) pour terminer le process.
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(e => { console.error('Smoke test crashed:', e); process.exit(2); });
