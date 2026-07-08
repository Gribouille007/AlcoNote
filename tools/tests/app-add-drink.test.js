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

async function tapWheelOption(listboxLabel, value) {
  const box = ctx.qa('[role="listbox"]').find((el) => (el.getAttribute('aria-label') || '') === listboxLabel);
  assert.ok(box, `roue « ${listboxLabel} » présente`);
  const opt = ctx.qa('[role="option"]').find((b) => b.parentElement === box && b.textContent === value)
    || ctx.qa('[role="option"]').find((b) => box.contains(b) && b.textContent === value);
  assert.ok(opt, `option ${value} présente dans ${listboxLabel}`);
  await ctx.act(async () => { ctx.click(opt); await ctx.sleep(80); });
}

test('heure — la roue (tap) définit l’heure, OK valide', async () => {
  await openAddSheet();
  await ctx.setInput(ctx.findInputByAria(/^Boisson$/), 'Wheel Pils');
  await pickRadio('Bière');
  await ctx.setInput(ctx.findInputByAria(/^Quantité$/), '33');
  await ctx.setInput(ctx.findInputByAria(/^Degré d'alcool$/), '5');

  // Ouvre la roue via le champ Heure (bouton aria-label="Heure").
  await ctx.clickAria(/^Heure$/, 250);
  await ctx.waitFor(() => ctx.qa('[role="listbox"]').some((el) => (el.getAttribute('aria-label') || '') === 'Heures'),
    { label: 'roue horaire ouverte' });
  await tapWheelOption('Heures', '07');
  await tapWheelOption('Minutes', '30');
  await ctx.clickText(/^OK$/, 250);

  await ctx.clickText(/^Enregistrer$/, 400);
  const d = (await db().getAllDrinks()).find((x) => x.name === 'Wheel Pils');
  assert.ok(d, 'boisson en DB');
  assert.equal(d.time, '07:30', 'heure choisie à la roue enregistrée');
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

test('prix intelligent — autre quantité préremplie au prorata du €/L, saisie manuelle respectée', async () => {
  // 1. Référence : Smart Pils 25 cL à 2 € (prix habituel coché par défaut).
  await openAddSheet();
  await ctx.setInput(ctx.findInputByAria(/^Boisson$/), 'Smart Pils');
  await pickRadio('Bière');
  await ctx.setInput(ctx.findInputByAria(/^Quantité$/), '25');
  await ctx.setInput(ctx.findInputByAria(/^Degré d'alcool$/), '5');
  await ctx.setInput(ctx.findInputByAria(/^Prix$/), '2');
  await ctx.clickText(/^Enregistrer$/, 400);
  const first = (await db().getAllDrinks()).find((x) => x.name === 'Smart Pils');
  assert.equal(first.price, 2, 'prix de la 1re entrée en DB');

  // 2. Même nom, 50 cL → le champ Prix se préremplit à 4 € (8 €/L × 0,5 L).
  await openAddSheet();
  await ctx.setInput(ctx.findInputByAria(/^Boisson$/), 'Smart Pils');
  await pickRadio('Bière');
  await ctx.setInput(ctx.findInputByAria(/^Quantité$/), '50');
  await ctx.setInput(ctx.findInputByAria(/^Degré d'alcool$/), '5');
  await ctx.waitFor(() => ctx.findInputByAria(/^Prix$/).value === '4',
    { label: 'prix suggéré 4 € pour 50 cL' });
  assert.match(ctx.text(), /Suggéré d'après 25 cL/, 'hint de suggestion affiché');

  // 3. La quantité change → la suggestion suit (33 cL → 2.64 €).
  await ctx.setInput(ctx.findInputByAria(/^Quantité$/), '33');
  await ctx.waitFor(() => ctx.findInputByAria(/^Prix$/).value === '2.64',
    { label: 'prix re-suggéré au prorata' });

  // 4. Une saisie manuelle coupe l'auto : changer la quantité ne l'écrase plus.
  await ctx.setInput(ctx.findInputByAria(/^Prix$/), '3');
  await ctx.setInput(ctx.findInputByAria(/^Quantité$/), '50');
  await ctx.sleep(150);
  assert.equal(ctx.findInputByAria(/^Prix$/).value, '3', 'prix manuel conservé');

  // 5. La suggestion reste à un tap après une saisie manuelle : le bouton
  //    « appliquer » ré-active l'auto (le champ suit de nouveau la quantité).
  const applyBtn = ctx.buttons().find((b) =>
    /Appliquer le prix suggéré/.test(b.getAttribute('aria-label') || ''));
  assert.ok(applyBtn, 'bouton « Suggestion — appliquer » visible après saisie manuelle');
  await ctx.act(async () => { ctx.click(applyBtn); await ctx.sleep(150); });
  assert.equal(ctx.findInputByAria(/^Prix$/).value, '4', 'suggestion ré-appliquée (50 cL → 4 €)');
  await ctx.setInput(ctx.findInputByAria(/^Quantité$/), '33');
  await ctx.waitFor(() => ctx.findInputByAria(/^Prix$/).value === '2.64',
    { label: 'l’auto suit à nouveau la quantité' });

  // 6. Nouvelle saisie manuelle, puis enregistrement : le prix tapé gagne.
  await ctx.setInput(ctx.findInputByAria(/^Quantité$/), '50');
  await ctx.setInput(ctx.findInputByAria(/^Prix$/), '3');
  await ctx.sleep(150);
  await ctx.clickText(/^Enregistrer$/, 400);
  const second = (await db().getAllDrinks()).find((x) => x.name === 'Smart Pils' && x.quantity === 50);
  assert.equal(second.price, 3, 'le prix saisi manuellement est enregistré');
});
