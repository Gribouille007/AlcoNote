// Boot de la vraie app compilée sous jsdom : tous les scripts s'évaluent,
// l'app monte, le splash disparaît, la navigation est en place.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { bootApp } = require('./helpers/boot-app');

let ctx;
test.before(async () => { ctx = await bootApp(); });
test.after(() => ctx && ctx.cleanup());

test('tous les scripts se chargent et l’app monte dans #root', () => {
  assert.ok(ctx.q('#root').children.length > 0, '#root peuplé');
});

test('le splash de chargement est retiré', () => {
  assert.equal(ctx.q('#alco-splash'), null);
});

test('4 onglets de navigation, dont « Amis »', () => {
  const tabs = ctx.tabs();
  assert.equal(tabs.length, 4);
  const labels = tabs.map((t) => t.getAttribute('aria-label'));
  for (const expected of ['Catégories', 'Historique', 'Stats', 'Amis']) {
    assert.ok(labels.some((l) => (l || '').includes(expected)), `onglet ${expected}`);
  }
});

test('header : bouton paramètres + titre + pile BAC', () => {
  const header = ctx.q('header');
  assert.ok(header, '<header> présent');
  const menu = ctx.buttons().find((b) => /paramètres/i.test(b.getAttribute('aria-label') || ''));
  assert.ok(menu, 'bouton « Ouvrir les paramètres »');
  assert.ok(header.querySelector('h1'), 'titre h1');
  const pill = header.querySelector('[aria-label="Taux d\'alcoolémie"]');
  assert.ok(pill, 'pastille BAC perso montée dans le header');
});

test('FAB « Ajouter une boisson » présent', () => {
  const fab = ctx.buttons().find((b) => /Ajouter une boisson/.test(b.getAttribute('aria-label') || ''));
  assert.ok(fab);
});

test('catégories par défaut affichées (Bière, Vin…)', async () => {
  await ctx.waitFor(() => ctx.text().includes('Bière'), { label: 'seed catégories' });
  const t = ctx.text();
  for (const cat of ['Bière', 'Vin', 'Spiritueux', 'Cocktail', 'Autre']) {
    assert.ok(t.includes(cat), `catégorie ${cat} visible`);
  }
});
