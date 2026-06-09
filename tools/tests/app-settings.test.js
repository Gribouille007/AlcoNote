// Tiroir Paramètres : poids (NumberField virgule, suppression de la clé),
// sexe, thème clair/sombre, export/import présents.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { bootApp } = require('./helpers/boot-app');

let ctx;
test.before(async () => {
  ctx = await bootApp();
  await ctx.waitFor(() => ctx.text().includes('Bière'), { label: 'seed' });
  await ctx.clickAria(/Ouvrir les paramètres/, 350);
  await ctx.waitFor(() => ctx.text().includes('Poids (kg)'), { label: 'tiroir ouvert' });
});
test.after(() => ctx && ctx.cleanup());

const db = () => ctx.window.dbManager;

test('poids : virgule acceptée, sauvegardé au blur', async () => {
  const input = ctx.findInputByAria(/^Poids \(kg\)$/);
  assert.ok(input, 'champ poids présent (NumberField)');
  assert.equal(input.getAttribute('inputmode'), 'decimal', 'pavé numérique mobile');
  await ctx.setInput(input, '72,5');
  await ctx.blurInput(input, 250);
  await ctx.waitFor(async () => (await db().getSetting('userWeight')) === 72.5,
    { label: 'poids sauvegardé' }).catch(() => {});
  assert.equal(await db().getSetting('userWeight'), 72.5, 'virgule → 72.5');
});

test('poids vidé : la clé est SUPPRIMÉE (pas de 0 fantôme)', async () => {
  const input = ctx.findInputByAria(/^Poids \(kg\)$/);
  // Attendre que le rechargement des settings ait resynchronisé le champ
  // (sinon la resync écraserait le clear — délai inhumain de quelques ms).
  await ctx.waitFor(() => input.value === '72.5', { label: 'champ resynchronisé' });
  await ctx.setInput(input, '');
  await ctx.blurInput(input, 250);
  assert.equal(await db().getSetting('userWeight'), null);
  const all = await db().getAllSettings();
  assert.ok(!('userWeight' in all), 'clé réellement supprimée');
});

test('sexe : sélection persistée', async () => {
  const femme = ctx.qa('[role="radio"]').find((b) => b.textContent === 'Femme');
  assert.ok(femme, 'radio Femme');
  await ctx.act(async () => { ctx.click(femme); await ctx.sleep(250); });
  assert.equal(await db().getSetting('userGender'), 'female');
});

test('thème : bascule Sombre ↔ Clair appliquée au document', async () => {
  await ctx.clickText(/Sombre/, 300);
  assert.equal(ctx.window.T._name, 'dark');
  assert.equal(ctx.document.documentElement.getAttribute('data-theme'), 'dark');
  await ctx.clickText(/Clair/, 300);
  assert.equal(ctx.window.T._name, 'light');
  assert.equal(ctx.document.documentElement.getAttribute('data-theme'), 'light');
});

test('export / import : actions présentes dans le tiroir', () => {
  const t = ctx.text();
  assert.ok(t.includes('Exporter'));
  assert.ok(t.includes('Importer'));
});

test('section Partage entre amis présente (désactivée par défaut)', () => {
  assert.ok(ctx.text().includes('Partage entre amis'));
});
