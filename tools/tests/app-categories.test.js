// Onglet Catégories : recherche + « + » (régression historique), CRUD
// catégorie (création / doublon / renommage cascade / suppression avec
// réassignation), drill-down familles.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { bootApp } = require('./helpers/boot-app');

let ctx;
test.before(async () => {
  ctx = await bootApp();
  await ctx.waitFor(() => ctx.text().includes('Bière'), { label: 'seed' });
  // Une famille existante pour la recherche.
  await ctx.act(async () => {
    await ctx.window.addDrink({
      name: 'Chouffe', category: 'Bière', quantity: 33, unit: 'cL', alcoholContent: 8,
      date: ctx.window.localDate(new Date()), time: '20:00',
    });
    await ctx.sleep(300);
  });
});
test.after(() => ctx && ctx.cleanup());

const db = () => ctx.window.dbManager;

test('RÉGRESSION : le « + » d’un résultat de recherche ajoute la boisson', async () => {
  const search = ctx.findInputByAria(/Rechercher/);
  assert.ok(search, 'champ de recherche présent');
  await ctx.setInput(search, 'chouffe', 250);
  await ctx.waitFor(
    () => ctx.buttons().some((b) => /^Ajouter Chouffe/.test(b.getAttribute('aria-label') || '')),
    { label: 'résultat de recherche avec +' }
  );
  const before = (await db().getAllDrinks()).length;
  const plus = ctx.buttons().find((b) => /^Ajouter Chouffe/.test(b.getAttribute('aria-label') || ''));
  // QuickAddButton écoute les pointer events, pas click (régression connue).
  await ctx.pointerTap(plus, 350);
  const drinks = await db().getAllDrinks();
  assert.equal(drinks.length, before + 1, 'une entrée ajoutée');
  assert.match(ctx.text(), /« Chouffe » ajoutée/, 'toast de confirmation');
  await ctx.setInput(search, '', 250); // reset recherche
});

test('créer une catégorie (nom) via EditCategorySheet mode create', async () => {
  await ctx.clickAria(/Créer une nouvelle catégorie/, 300);
  await ctx.waitFor(() => ctx.findInputByAria(/Nom de la catégorie/), { label: 'sheet création' });
  await ctx.setInput(ctx.findInputByAria(/Nom de la catégorie/), 'Hydromel');
  await ctx.clickText(/Créer la catégorie/, 400);
  const cat = await db().getCategoryByName('Hydromel');
  assert.ok(cat, 'catégorie créée en DB');
  await ctx.waitFor(() => ctx.text().includes('Hydromel'), { label: 'carte visible' });
});

test('doublon (casse / espace) refusé AVANT mutation', async () => {
  await ctx.clickAria(/Créer une nouvelle catégorie/, 300);
  await ctx.setInput(ctx.findInputByAria(/Nom de la catégorie/), 'bière ');
  const before = (await db().getAllCategories()).length;
  await ctx.clickText(/Créer la catégorie/, 300);
  assert.match(ctx.text(), /existe déjà/, 'message d’erreur affiché');
  assert.equal((await db().getAllCategories()).length, before, 'aucune mutation');
  // Referme la sheet (Annuler ou Fermer).
  const cancel = ctx.buttons().find((b) => /^(Annuler|Fermer)$/.test(b.textContent || '')
    || /Fermer/.test(b.getAttribute('aria-label') || ''));
  if (cancel) await ctx.act(async () => { ctx.click(cancel); await ctx.sleep(250); });
});

test('renommer une catégorie cascade sur ses boissons', async () => {
  await ctx.act(async () => {
    await ctx.window.addDrink({
      name: 'Mielée', category: 'Hydromel', quantity: 25, unit: 'cL', alcoholContent: 12,
      date: ctx.window.localDate(new Date()), time: '21:00',
    });
    await ctx.sleep(300);
  });
  await ctx.clickAria(/Modifier.*Hydromel/, 300);
  await ctx.waitFor(() => ctx.findInputByAria(/Nom de la catégorie/), { label: 'sheet édition' });
  await ctx.setInput(ctx.findInputByAria(/Nom de la catégorie/), 'Mead');
  await ctx.clickText(/^Enregistrer$/, 450);

  assert.ok(await db().getCategoryByName('Mead'), 'catégorie renommée');
  assert.equal(await db().getCategoryByName('Hydromel'), undefined, 'ancien nom disparu');
  const drink = (await db().getAllDrinks()).find((d) => d.name === 'Mielée');
  assert.equal(drink.category, 'Mead', 'boisson cascadée');
});

test('supprimer avec réassignation : boissons migrées, icône purgée', async () => {
  const mead = await db().getCategoryByName('Mead');
  await ctx.act(async () => {
    await ctx.window.setCategoryIcon(mead.id, 'Vin');
    await ctx.sleep(150);
  });
  assert.equal(await db().getSetting(`cat.icon.id.${mead.id}`), 'Vin', 'icône override posée');

  await ctx.act(async () => {
    await ctx.window.deleteCategory(mead.id, { reassignTo: 'Autre' });
    await ctx.sleep(300);
  });
  assert.equal(await db().getCategoryByName('Mead'), undefined, 'catégorie supprimée');
  const drink = (await db().getAllDrinks()).find((d) => d.name === 'Mielée');
  assert.equal(drink.category, 'Autre', 'boisson réassignée');
  assert.equal(await db().getSetting(`cat.icon.id.${mead.id}`), null, 'icône override purgée');
});

test('drill-down dans une catégorie et retour', async () => {
  await ctx.clickAria(/Ouvrir la catégorie Bière/, 300);
  assert.ok(ctx.text().includes('Chouffe'), 'famille listée dans la catégorie');
  await ctx.clickAria(/Retour/, 300);
  assert.ok(ctx.text().includes('Vos catégories'), 'retour à la grille');
});
