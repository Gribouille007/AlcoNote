// Flux d'ajout de boisson : AddDrinkSheet (NumberField virgule ET point,
// chips de catégorie, toggle d'unité) + prefill « Ajouter à nouveau ».
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { bootApp } = require('./helpers/boot-app');

let ctx;
test.before(async () => {
  ctx = await bootApp();
  await ctx.waitFor(() => ctx.text().includes('Bière'), { label: 'seed' });
});
test.after(() => ctx && ctx.cleanup());

const db = () => ctx.window.dbManager;

async function openAddSheet() {
  await ctx.clickAria(/Ajouter une boisson/, 250);
  await ctx.waitFor(() => ctx.findInputByAria(/^Boisson$/), { label: 'AddDrinkSheet ouverte' });
}

async function pickRadio(text) {
  const el = ctx.qa('[role="radio"]').find((b) => b.textContent === text);
  assert.ok(el, `radio « ${text} » présent`);
  await ctx.act(async () => { ctx.click(el); await ctx.sleep(60); });
}

test('ajout — la VIRGULE décimale est acceptée (NumberField)', async () => {
  await openAddSheet();
  await ctx.setInput(ctx.findInputByAria(/^Boisson$/), 'Test Pils');
  await pickRadio('Bière');
  await ctx.setInput(ctx.findInputByAria(/^Quantité$/), '33');
  await ctx.setInput(ctx.findInputByAria(/^Degré d'alcool$/), '5,5');
  await ctx.clickText(/^Enregistrer$/, 400);

  const d = (await db().getAllDrinks()).find((x) => x.name === 'Test Pils');
  assert.ok(d, 'boisson en DB');
  assert.equal(d.alcoholContent, 5.5, 'virgule parsée en 5.5');
  assert.equal(d.quantity, 33);
  assert.equal(d.quantityInCL, 33);
  assert.equal(d.category, 'Bière');
  assert.ok(d.uid, 'uid présent');
  assert.equal(ctx.findInputByAria(/^Boisson$/), undefined, 'sheet fermée après enregistrement');
});

test('ajout — le POINT décimal + unité L (conversion en cL)', async () => {
  await openAddSheet();
  await ctx.setInput(ctx.findInputByAria(/^Boisson$/), 'Test Litre');
  await pickRadio('Vin');
  await ctx.setInput(ctx.findInputByAria(/^Quantité$/), '0.5');
  await pickRadio('L');
  await ctx.setInput(ctx.findInputByAria(/^Degré d'alcool$/), '8.5');
  await ctx.clickText(/^Enregistrer$/, 400);

  const d = (await db().getAllDrinks()).find((x) => x.name === 'Test Litre');
  assert.ok(d);
  assert.equal(d.alcoholContent, 8.5);
  assert.equal(d.quantityInCL, 50, '0,5 L → 50 cL');
  assert.equal(d.unit, 'L');
});

test('ajout — unité EcoCup (25 cL pièce)', async () => {
  await openAddSheet();
  await ctx.setInput(ctx.findInputByAria(/^Boisson$/), 'Test Cup');
  await pickRadio('Cocktail');
  await ctx.setInput(ctx.findInputByAria(/^Quantité$/), '2');
  await pickRadio('EcoCup');
  await ctx.setInput(ctx.findInputByAria(/^Degré d'alcool$/), '11');
  await ctx.clickText(/^Enregistrer$/, 400);

  const d = (await db().getAllDrinks()).find((x) => x.name === 'Test Cup');
  assert.equal(d.quantityInCL, 50, '2 EcoCup → 50 cL');
});

test('« Ajouter à nouveau » depuis la fiche détail — prefill complet', async () => {
  // Catégories → Bière → détail de la famille Test Pils.
  await ctx.clickAria(/^Catégories$/, 250);
  await ctx.clickAria(/Ouvrir la catégorie Bière/, 300);
  await ctx.clickAria(/Voir les détails de Test Pils/, 300);
  await ctx.clickText(/Ajouter à nouveau/, 350);

  await ctx.waitFor(() => ctx.findInputByAria(/^Boisson$/), { label: 'sheet préremplie' });
  assert.equal(ctx.findInputByAria(/^Boisson$/).value, 'Test Pils', 'nom prérempli');
  assert.equal(ctx.findInputByAria(/^Quantité$/).value, '33', 'quantité préremplie');
  assert.equal(ctx.findInputByAria(/^Degré d'alcool$/).value, '5.5', 'degré prérempli');

  await ctx.clickText(/^Enregistrer$/, 400);
  const fam = (await db().getAllDrinks()).filter((x) => x.name === 'Test Pils');
  assert.equal(fam.length, 2, 'la famille compte 2 entrées');
  // L'identité de famille est intacte (mêmes tuples).
  assert.equal(fam[0].quantityInCL, fam[1].quantityInCL);
  assert.equal(fam[0].alcoholContent, fam[1].alcoholContent);
});
