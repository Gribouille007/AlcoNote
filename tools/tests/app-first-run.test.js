// Premier lancement : AUCUNE catégorie n'est créée d'office. L'utilisateur
// part d'une grille vide et crée les siennes — depuis la grille, ou à la
// volée depuis le formulaire d'ajout (chip « + Nouvelle »).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { bootApp } = require('./helpers/boot-app');

let ctx;
test.before(async () => {
  ctx = await bootApp({ categories: [] });
});
test.after(() => ctx && ctx.cleanup());

const db = () => ctx.window.dbManager;

test('premier lancement : aucune catégorie créée automatiquement', async () => {
  await ctx.waitFor(() => ctx.text().includes('Aucune catégorie'), { label: 'grille vide' });
  await ctx.flush(300); // laisse passer tout chargement / migration différé
  assert.equal((await db().getAllCategories()).length, 0, 'table catégories vide');
  for (const cat of ['Bière', 'Spiritueux', 'Cocktail']) {
    assert.ok(!ctx.text().includes(cat), `pas de « ${cat} » imposée`);
  }
  assert.ok(ctx.buttons().some((b) => /Créer une nouvelle catégorie/.test(b.getAttribute('aria-label') || '')),
    'bouton « Nouvelle catégorie » proposé');
});

test('ajout sans catégorie : le formulaire propose d’en nommer une, créée à l’enregistrement', async () => {
  await ctx.clickAria(/Ajouter une boisson/, 250);
  await ctx.waitFor(() => ctx.findInputByAria(/^Boisson$/), { label: 'AddDrinkSheet ouverte' });
  const field = ctx.findInputByAria(/^Nom de la nouvelle catégorie$/);
  assert.ok(field, 'champ « nouvelle catégorie » ouvert d’emblée');
  // Rien n'est écrit tant que la boisson n'est pas enregistrée.
  await ctx.setInput(field, '  Bières belges ');
  await ctx.clickText(/^Choisir$/, 120);
  assert.equal((await db().getAllCategories()).length, 0, 'pas encore créée');
  const chip = ctx.qa('[role="radio"]').find((b) => /Bières belges/.test(b.textContent));
  assert.ok(chip && chip.getAttribute('aria-checked') === 'true', 'nouvelle catégorie sélectionnée');

  await ctx.setInput(ctx.findInputByAria(/^Boisson$/), 'Orval');
  await ctx.setInput(ctx.findInputByAria(/^Quantité$/), '33');
  await ctx.setInput(ctx.findInputByAria(/^Degré d'alcool$/), '6,2');
  await ctx.clickText(/^Enregistrer$/, 500);

  const cats = await db().getAllCategories();
  assert.deepEqual(cats.map((c) => c.name), ['Bières belges'], 'catégorie créée (nom nettoyé)');
  const d = (await db().getAllDrinks()).find((x) => x.name === 'Orval');
  assert.ok(d, 'boisson enregistrée');
  assert.equal(d.category, 'Bières belges');
  await ctx.waitFor(() => !ctx.text().includes('Aucune catégorie pour le moment'), { label: 'grille peuplée' });
});

test('« + Nouvelle » : un nom équivalent (casse, espaces) sélectionne l’existante — pas de doublon', async () => {
  await ctx.clickAria(/Ajouter une boisson/, 250);
  await ctx.waitFor(() => ctx.findInputByAria(/^Boisson$/), { label: 'AddDrinkSheet ouverte' });
  await ctx.clickAria(/^Nouvelle catégorie pour cette boisson$/, 120);
  await ctx.setInput(ctx.findInputByAria(/^Nom de la nouvelle catégorie$/), ' BIÈRES belges ');
  await ctx.clickText(/^Choisir$/, 120);
  const on = ctx.qa('[role="radio"][aria-checked="true"]').map((b) => b.textContent);
  assert.ok(on.includes('Bières belges'), 'existante sélectionnée');
  assert.ok(!on.some((t) => /nouvelle/.test(t)), 'aucune « nouvelle » en attente');
  await ctx.setInput(ctx.findInputByAria(/^Boisson$/), 'Chimay');
  await ctx.setInput(ctx.findInputByAria(/^Quantité$/), '33');
  await ctx.clickText(/^Enregistrer$/, 500);
  assert.equal((await db().getAllCategories()).length, 1, 'toujours une seule catégorie');
  const d = (await db().getAllDrinks()).find((x) => x.name === 'Chimay');
  assert.equal(d.category, 'Bières belges');
});

test('nom de catégorie tapé puis « Enregistrer » direct (sans « Choisir ») : validé au blur', async () => {
  await ctx.clickAria(/Ajouter une boisson/, 250);
  await ctx.waitFor(() => ctx.findInputByAria(/^Boisson$/), { label: 'AddDrinkSheet ouverte' });
  await ctx.clickAria(/^Nouvelle catégorie pour cette boisson$/, 120);
  const field = ctx.findInputByAria(/^Nom de la nouvelle catégorie$/);
  await ctx.setInput(field, 'Vins');
  await ctx.blurInput(field);
  await ctx.setInput(ctx.findInputByAria(/^Boisson$/), 'Côtes du Rhône');
  await ctx.setInput(ctx.findInputByAria(/^Quantité$/), '12');
  await ctx.clickText(/^Enregistrer$/, 500);
  const d = (await db().getAllDrinks()).find((x) => x.name === 'Côtes du Rhône');
  assert.ok(d, 'boisson enregistrée');
  assert.equal(d.category, 'Vins');
  assert.ok((await db().getAllCategories()).some((c) => c.name === 'Vins'), 'catégorie créée');
});
