// Parcours « logiques pour un humain » : re-tap sur l'onglet actif, « + »
// contextuel (catégorie imposée / dernière utilisée), autocomplétion du nom,
// ajout en un tap réversible, favoris épinglés, fiche détail (ajout direct,
// édition d'une entrée), état vide d'une catégorie, pastille BAC tapable,
// navigation de période sans futur, activation du partage depuis l'onglet.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { bootApp } = require('./helpers/boot-app');

let ctx;
test.before(async () => {
  ctx = await bootApp();
  await ctx.waitFor(() => ctx.text().includes('Bière'), { label: 'seed' });
  await ctx.act(async () => {
    const today = ctx.window.localDate(new Date());
    await ctx.window.addDrink({ name: 'Jupiler', category: 'Bière', quantity: 25, unit: 'cL', alcoholContent: 5.2, date: today, time: '19:00' });
    await ctx.window.addDrink({ name: 'Jupiler', category: 'Bière', quantity: 50, unit: 'cL', alcoholContent: 5.2, date: today, time: '19:30' });
    // Dernière boisson ENREGISTRÉE : un vin → catégorie par défaut du « + ».
    await ctx.window.addDrink({ name: 'Côtes du Rhône', category: 'Vin', quantity: 12, unit: 'cL', alcoholContent: 13, date: today, time: '18:00' });
    await ctx.sleep(300);
  });
});
test.after(() => ctx && ctx.cleanup());

const db = () => ctx.window.dbManager;
const radios = () => ctx.qa('[role="radio"]');
const checkedRadio = (text) => radios().find((r) => r.textContent === text && r.getAttribute('aria-checked') === 'true');
const closeSheet = async () => {
  const b = ctx.buttons().find((x) => x.getAttribute('aria-label') === 'Fermer');
  if (b) await ctx.act(async () => { ctx.click(b); await ctx.sleep(300); });
};

test('re-tap sur l’onglet Catégories : sort du drill-down ET vide la recherche', async () => {
  await ctx.clickAria(/Ouvrir la catégorie Bière/, 250);
  await ctx.setInput(ctx.findInputByAria(/Rechercher/), 'jup', 150);
  assert.ok(ctx.buttons().some((b) => b.getAttribute('aria-label') === 'Retour aux catégories'),
    'dans le drill-down');
  await ctx.clickAria(/^Catégories$/, 250);
  assert.ok(ctx.buttons().some((b) => /Créer une nouvelle catégorie/.test(b.getAttribute('aria-label') || '')),
    'grille racine affichée');
  assert.equal(ctx.findInputByAria(/Rechercher/).value, '', 'recherche vidée');
});

test('« Retour » depuis une catégorie vide aussi la recherche (pas de recherche fantôme à la racine)', async () => {
  await ctx.clickAria(/Ouvrir la catégorie Bière/, 250);
  await ctx.setInput(ctx.findInputByAria(/Rechercher/), 'jup', 150);
  await ctx.clickAria(/Retour aux catégories/, 250);
  assert.equal(ctx.findInputByAria(/Rechercher/).value, '');
  assert.ok(!/résultat/.test(ctx.text()), 'pas de liste de résultats à la racine');
});

test('« + » depuis une catégorie : catégorie IMPOSÉE (pas de sélecteur) et respectée à l’enregistrement', async () => {
  await ctx.clickAria(/Ouvrir la catégorie Vin/, 250);
  await ctx.clickAria(/Ajouter une boisson/, 300);
  await ctx.waitFor(() => ctx.findInputByAria(/^Boisson$/), { label: 'sheet ouverte' });
  assert.ok(!radios().some((r) => r.textContent === 'Bière'), 'aucune puce de catégorie');
  assert.ok(ctx.qa('[aria-label="Catégorie : Vin"]').length === 1, 'étiquette « Vin » affichée');
  // L'autocomplétion ne propose que les boissons de la catégorie imposée.
  await ctx.setInput(ctx.findInputByAria(/^Boisson$/), 'e', 150);
  const opts = ctx.qa('[role="option"]').map((o) => o.getAttribute('aria-label'));
  assert.ok(opts.length > 0 && opts.every((l) => /Côtes du Rhône/.test(l)), 'suggestions limitées au Vin');
  await ctx.setInput(ctx.findInputByAria(/^Boisson$/), 'Rosé maison');
  await ctx.setInput(ctx.findInputByAria(/^Quantité$/), '15');
  await ctx.setInput(ctx.findInputByAria(/^Degré d'alcool$/), '12');
  await ctx.clickText(/^Enregistrer$/, 400);
  const d = (await db().getAllDrinks()).find((x) => x.name === 'Rosé maison');
  assert.ok(d, 'enregistrée');
  assert.equal(d.category, 'Vin', 'dans la catégorie imposée');
  await ctx.clickAria(/^Catégories$/, 250);
});

test('catégorie vide : message + bouton qui ouvre l’ajout DANS cette catégorie', async () => {
  await ctx.clickAria(/Ouvrir la catégorie Spiritueux/, 250);
  assert.match(ctx.text(), /Aucune boisson ici/);
  await ctx.clickAria(/Ajouter une boisson dans Spiritueux/, 300);
  await ctx.waitFor(() => ctx.findInputByAria(/^Boisson$/), { label: 'sheet ouverte' });
  assert.ok(ctx.qa('[aria-label="Catégorie : Spiritueux"]').length === 1, 'Spiritueux imposé');
  await closeSheet();
  await ctx.clickAria(/^Catégories$/, 250);
});

test('« + » depuis la racine : catégorie par défaut = DERNIÈRE utilisée, autocomplétion qui remplit tout', async () => {
  // La dernière boisson enregistrée est « Rosé maison » (Vin).
  await ctx.clickAria(/Ajouter une boisson/, 300);
  await ctx.waitFor(() => checkedRadio('Vin'), { label: 'Vin coché par défaut' });
  await ctx.setInput(ctx.findInputByAria(/^Boisson$/), 'jup', 150);
  const opt = ctx.qa('[role="option"]').find((o) => /Jupiler, 50 cL/.test(o.getAttribute('aria-label') || ''));
  assert.ok(opt, 'variante 50 cL proposée');
  await ctx.act(async () => { ctx.click(opt); await ctx.sleep(150); });
  assert.equal(ctx.findInputByAria(/^Boisson$/).value, 'Jupiler');
  assert.equal(ctx.findInputByAria(/^Quantité$/).value, '50');
  assert.equal(ctx.findInputByAria(/^Degré d'alcool$/).value, '5.2');
  assert.ok(checkedRadio('Bière'), 'catégorie reprise de la variante');
  assert.equal(ctx.qa('[role="option"]').length, 0, 'suggestions refermées après le choix');
  await closeSheet();
});

test('ajout rapide « + » : toast avec « Annuler » qui retire la boisson', async () => {
  await ctx.clickAria(/Ouvrir la catégorie Bière/, 250);
  const plus = ctx.buttons().find((b) => /^Ajouter Jupiler \(25 cL/.test(b.getAttribute('aria-label') || ''));
  assert.ok(plus);
  const before = (await db().getAllDrinks()).length;
  await ctx.pointerTap(plus, 350);
  assert.equal((await db().getAllDrinks()).length, before + 1, 'ajoutée');
  await ctx.clickText(/^Annuler$/, 350);
  assert.equal((await db().getAllDrinks()).length, before, 'annulée');
  assert.match(ctx.text(), /Ajout annulé/);
});

test('fiche détail : « Ajouter » enregistre DIRECTEMENT, la fiche reste ouverte', async () => {
  await ctx.clickAria(/Voir les détails de Jupiler/, 300);
  const before = (await db().getAllDrinks()).filter((d) => d.name === 'Jupiler' && d.quantity === 25).length;
  await ctx.clickAria(/^Ajouter Jupiler maintenant$/, 400);
  const after = (await db().getAllDrinks()).filter((d) => d.name === 'Jupiler' && d.quantity === 25).length;
  assert.equal(after, before + 1, 'une entrée de plus');
  assert.equal(ctx.findInputByAria(/^Boisson$/), undefined, 'aucun formulaire ouvert');
  await ctx.waitFor(() => new RegExp(`Historique · ${after} entrée`).test(ctx.text()),
    { label: 'timeline à jour' });
});

test('fiche détail : taper une entrée ouvre SON édition', async () => {
  await ctx.clickAria(/Modifier l'entrée du/, 350);
  await ctx.waitFor(() => ctx.text().includes("Modifier l'entrée") && ctx.findInputByAria(/^Nom$/),
    { label: 'EditEntrySheet' });
  assert.equal(ctx.findInputByAria(/^Nom$/).value, 'Jupiler');
  const cancel = ctx.buttons().filter((b) => b.textContent === 'Annuler').pop();
  await ctx.act(async () => { ctx.click(cancel); await ctx.sleep(300); });
  assert.ok(ctx.text().includes('Historique ·'), 'la fiche détail est toujours là');
});

test('favori : l’étoile de la fiche épingle la VARIANTE, le bandeau l’ajoute en un tap', async () => {
  await ctx.clickAria(/Épingler Jupiler en favori/, 300);
  const favs = JSON.parse(await db().getSetting('fav.families'));
  assert.deepEqual(favs, [ctx.window.familyKey('Jupiler', 25, 'cL', 5.2)], 'variante 25 cL épinglée');
  await closeSheet();
  await ctx.clickAria(/^Catégories$/, 250);
  const list = ctx.q('[role="list"][aria-label="Favoris"]');
  assert.ok(list, 'bandeau Favoris');
  const chip = [...list.querySelectorAll('button')][0];
  assert.match(chip.getAttribute('aria-label'), /^Ajouter Jupiler \(25 cL/);
  const before = (await db().getAllDrinks()).length;
  await ctx.act(async () => { ctx.click(chip); await ctx.sleep(350); });
  assert.equal((await db().getAllDrinks()).length, before + 1, 'ajoutée en un tap');
  assert.match(ctx.text(), /Annuler/, 'réversible');
});

test('favori : renommer la famille garde l’épingle', async () => {
  await ctx.clickAria(/Ouvrir la catégorie Bière/, 250);
  await ctx.clickAria(/Voir les détails de Jupiler/, 300);
  // Le « Modifier » de la FICHE (le dernier du DOM ; celui de l'en-tête de
  // catégorie, derrière la fiche, porte le même texte).
  const edit = ctx.buttons().filter((b) => /^\s*Modifier$/.test(b.textContent || '')).pop();
  await ctx.act(async () => { ctx.click(edit); await ctx.sleep(300); });
  await ctx.waitFor(() => ctx.findInputByAria(/^Nom$/), { label: 'EditFamilySheet' });
  await ctx.setInput(ctx.findInputByAria(/^Nom$/), 'Jupiler Pils');
  await ctx.clickText(/^Enregistrer$/, 500);
  const favs = JSON.parse(await db().getSetting('fav.families'));
  assert.deepEqual(favs, [ctx.window.familyKey('Jupiler Pils', 25, 'cL', 5.2)]);
  await ctx.clickAria(/^Catégories$/, 250);
});

test('pastille BAC de l’en-tête : ouvre Stats sur la section Alcoolémie', async () => {
  await ctx.clickAria(/Voir le détail de mon taux/, 500);
  const statsTab = ctx.tabs().find((t) => t.textContent.includes('Stats'));
  assert.equal(statsTab.getAttribute('aria-selected'), 'true', 'onglet Stats actif');
  const jour = ctx.tabs().find((t) => t.textContent === 'Jour');
  assert.equal(jour.getAttribute('aria-selected'), 'true', 'période Jour');
  await ctx.waitFor(() => ctx.q('[data-stats-section="bac"]'), { label: 'section BAC rendue' });
});

test('Stats : pas de navigation vers le futur, retour rapide à la période actuelle', async () => {
  const next = () => ctx.buttons().find((b) => b.getAttribute('aria-label') === 'Période suivante');
  assert.equal(next().disabled, true, 'période courante → suivante désactivée');
  await ctx.clickAria(/^Période précédente$/, 200);
  assert.equal(next().disabled, false, 'passé → suivante possible');
  await ctx.clickText(/Revenir à aujourd'hui/, 200);
  assert.equal(next().disabled, true, 'revenu à la période courante');
  assert.ok(!ctx.text().includes("Revenir à aujourd'hui"), 'lien masqué sur la période courante');
});

test('Amis : « Activer le partage » directement depuis l’onglet (avec confirmation)', async () => {
  await ctx.clickAria(/^Amis$/, 300);
  await ctx.clickText(/^Activer le partage$/, 300);
  assert.match(ctx.text(), /Activer le partage entre amis \?/, 'confirmation affichée');
  await ctx.clickText(/^Activer$/, 500);
  assert.equal(ctx.window.shareEngine.state.enabled, true, 'partage activé');
});
