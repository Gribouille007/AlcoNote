// Onglet Historique : groupement par jour, filtre catégorie canonique,
// édition d'une ENTRÉE vs édition de FAMILLE, suppression + undo.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { bootApp } = require('./helpers/boot-app');

let ctx;
const today = () => ctx.window.localDate(new Date());
const yesterday = () => ctx.window.localDate(new Date(Date.now() - 24 * 3600_000));

test.before(async () => {
  ctx = await bootApp();
  await ctx.waitFor(() => ctx.text().includes('Bière'), { label: 'seed' });
  await ctx.act(async () => {
    // Famille A : deux entrées (aujourd'hui + hier).
    await ctx.window.addDrink({ name: 'Histo A', category: 'Bière', quantity: 33, unit: 'cL', alcoholContent: 5, date: today(), time: '12:00' });
    await ctx.window.addDrink({ name: 'Histo A', category: 'Bière', quantity: 33, unit: 'cL', alcoholContent: 5, date: yesterday(), time: '13:00' });
    // Catégorie avec espace final (legacy) : doit suivre le filtre « Bière ».
    await ctx.window.addDrink({ name: 'Histo B', category: 'Bière ', quantity: 25, unit: 'cL', alcoholContent: 6, date: today(), time: '14:00' });
    // Témoin dans une autre catégorie.
    await ctx.window.addDrink({ name: 'Histo C', category: 'Vin', quantity: 12, unit: 'cL', alcoholContent: 13, date: today(), time: '15:00' });
    await ctx.sleep(350);
  });
  await ctx.clickAria(/^Historique$/, 350);
  await ctx.waitFor(() => ctx.text().includes('Histo A'), { label: 'historique peuplé' });
});
test.after(() => ctx && ctx.cleanup());

const db = () => ctx.window.dbManager;

test('groupement par jour : aujourd’hui + hier, toggles repliables', () => {
  const toggles = ctx.buttons().filter((b) => /^(Replier|Déplier)/.test(b.getAttribute('aria-label') || ''));
  assert.ok(toggles.length >= 2, 'au moins deux groupes de jours');
  assert.ok(toggles.every((b) => b.hasAttribute('aria-expanded')), 'état exposé via aria-expanded');
});

test('filtre catégorie : « Bière  » (espace legacy) reste visible, Vin masqué', async () => {
  // Pill « Bière » de la rangée de filtres (préfixée d'un ● coloré).
  const pill = ctx.buttons().find((b) =>
    b.hasAttribute('aria-pressed') && (b.textContent || '').trim().endsWith('Bière'));
  assert.ok(pill, 'pill de filtre Bière');
  await ctx.act(async () => { ctx.click(pill); await ctx.sleep(250); });
  const t = ctx.text();
  assert.ok(t.includes('Histo A'), 'catégorie exacte visible');
  assert.ok(t.includes('Histo B'), 'catégorie avec espace final visible (canonicalCat)');
  assert.ok(!t.includes('Histo C'), 'l’autre catégorie est filtrée');
  await ctx.clickText(/^Tous$/, 250);
  assert.ok(ctx.text().includes('Histo C'), 'filtre levé');
});

test('éditer une ENTRÉE ne touche pas le reste de la famille', async () => {
  const entryBtn = ctx.buttons().find((b) => /^Modifier Histo A/.test(b.getAttribute('aria-label') || ''));
  assert.ok(entryBtn, 'entrée cliquable');
  await ctx.act(async () => { ctx.click(entryBtn); await ctx.sleep(300); });
  await ctx.waitFor(() => ctx.findInputByAria(/^Quantité$/), { label: 'EditEntrySheet' });
  await ctx.setInput(ctx.findInputByAria(/^Quantité$/), '40');
  await ctx.clickText(/^Enregistrer$/, 400);

  const fam = (await db().getAllDrinks()).filter((d) => d.name === 'Histo A');
  assert.equal(fam.length, 2);
  const qtys = fam.map((d) => d.quantity).sort((a, b) => a - b);
  assert.deepEqual(qtys, [33, 40], 'une seule entrée modifiée, l’autre intacte');
  const edited = fam.find((d) => d.quantity === 40);
  assert.equal(edited.quantityInCL, 40, 'quantityInCL recalculé');
});

test('éditer une FAMILLE cascade sur toutes ses entrées (updateFamily)', async () => {
  const drinks = await db().getAllDrinks();
  const fams = ctx.window.buildFamilies(drinks, {}, {});
  const famB = fams.find((f) => f.name === 'Histo B');
  assert.ok(famB);
  await ctx.act(async () => {
    await ctx.window.updateFamily(famB, { category: 'Vin' });
    await ctx.sleep(300);
  });
  const moved = (await db().getAllDrinks()).filter((d) => d.name === 'Histo B');
  assert.ok(moved.every((d) => d.category === 'Vin'), 'toutes les entrées déplacées');
});

test('suppression (couche danger) + undo via le toast', async () => {
  const before = await db().getAllDrinks();
  const del = ctx.qa('span').find((s) => s.textContent === 'Supprimer');
  assert.ok(del, 'couche de suppression présente');
  await ctx.act(async () => { ctx.click(del); await ctx.sleep(350); });

  const mid = await db().getAllDrinks();
  assert.equal(mid.length, before.length - 1, 'entrée supprimée');
  assert.match(ctx.text(), /Boisson supprimée/, 'toast avec undo');

  await ctx.clickText(/^Annuler$/, 350);
  const after = await db().getAllDrinks();
  assert.equal(after.length, before.length, 'restoreDrinks a restauré l’entrée');
  assert.match(ctx.text(), /Suppression annulée/);
  // Mêmes boissons (l'id peut changer, pas l'identité).
  const names = (arr) => arr.map((d) => `${d.name}|${d.date}|${d.time}`).sort();
  assert.deepEqual(names(after), names(before));
});

test('filtre orphelin : renommer la catégorie filtrée re-bascule sur « Tous »', async () => {
  // Active le filtre « Vin »…
  const pill = ctx.buttons().find((b) =>
    b.hasAttribute('aria-pressed') && (b.textContent || '').trim().endsWith('Vin'));
  assert.ok(pill, 'pill de filtre Vin');
  await ctx.act(async () => { ctx.click(pill); await ctx.sleep(250); });
  assert.ok(!ctx.text().includes('Histo A'), 'filtre Vin actif (Bière masquée)');

  // … puis renomme la catégorie sous le filtre : sans reset, la liste
  // resterait vide sans aucune pilule active.
  await ctx.act(async () => {
    await ctx.window.renameCategory('Vin', 'Vinasse');
    await ctx.sleep(350);
  });
  await ctx.waitFor(() => ctx.text().includes('Histo A'), { label: 'retour à « Tous »' });
  const tous = ctx.buttons().find((b) =>
    b.hasAttribute('aria-pressed') && (b.textContent || '').trim() === 'Tous');
  assert.equal(tous.getAttribute('aria-pressed'), 'true', 'pilule « Tous » redevenue active');
  // Remet le nom d'origine pour les tests suivants.
  await ctx.act(async () => {
    await ctx.window.renameCategory('Vinasse', 'Vin');
    await ctx.sleep(350);
  });
});

test('recherche dans l’historique', async () => {
  const search = ctx.findInputByAria(/Rechercher dans l/);
  assert.ok(search);
  await ctx.setInput(search, 'Histo C', 300);
  const t = ctx.text();
  assert.ok(t.includes('Histo C'));
  assert.ok(!t.includes('Histo A'), 'les autres familles sont filtrées');
  await ctx.setInput(search, '', 250);
});
