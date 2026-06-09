// js/database.js (DatabaseManager + Dexie) sur IndexedDB en mémoire.
// Scénario séquentiel : fake-indexeddb est un singleton par process, la base
// vit pour toute la durée du fichier (node --test = un process par fichier).
'use strict';
require('fake-indexeddb/auto');
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { installStubs, ROOT } = require('./helpers/stub-globals');

installStubs();
global.Dexie = require('dexie');
require(path.join(ROOT, 'js', 'database.js'));
const dbManager = global.window.dbManager;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test('ouverture + settings par défaut initialisés', async () => {
  await dbManager.db.open();
  await sleep(80); // initializeDefaultData est async non-await dans le constructeur
  const settings = await dbManager.getAllSettings();
  assert.equal(settings.theme, 'light');
  assert.equal(settings.language, 'fr');
  assert.ok('userWeight' in settings);
});

test('genUid — unicité et format', () => {
  const genUid = global.genUid;
  assert.equal(typeof genUid, 'function');
  const uids = new Set(Array.from({ length: 1000 }, () => genUid()));
  assert.equal(uids.size, 1000, '1000 uids distincts');
  const u = genUid();
  assert.match(u, /^([0-9a-f-]{36}|uid-[a-z0-9]+-[a-z0-9]+)$/i, 'UUID ou fallback uid-…');
});

test('addCategory — trim + doublon refusé', async () => {
  const cat = await dbManager.addCategory({ name: '  Bière  ' });
  assert.equal(cat.name, 'Bière');
  assert.equal(cat.drinkCount, 0);
  await assert.rejects(
    () => dbManager.addCategory({ name: 'Bière' }),
    /existe déjà/
  );
  await assert.rejects(() => dbManager.addCategory({ name: '   ' }), /invalide/);
});

test('addDrink — conversion quantityInCL par unité, uid auto, prix', async () => {
  const cl = await dbManager.addDrink({
    name: 'Pils', category: 'Bière', quantity: 33, unit: 'cL',
    alcoholContent: 5, date: '2026-06-01', time: '20:00',
  });
  assert.equal(cl.quantityInCL, 33);
  assert.ok(cl.uid, 'uid généré automatiquement');
  assert.equal(cl.price, null);
  assert.equal(cl.priceIsCustom, false);

  const litre = await dbManager.addDrink({
    name: 'Pinte double', category: 'Bière', quantity: 0.5, unit: 'L',
    alcoholContent: 5, date: '2026-06-01', time: '21:00', price: 12, priceIsCustom: true,
  });
  assert.equal(litre.quantityInCL, 50);
  assert.equal(litre.price, 12);
  assert.equal(litre.priceIsCustom, true);

  const cup = await dbManager.addDrink({
    name: 'Bière pression', category: 'Bière', quantity: 2, unit: 'EcoCup',
    alcoholContent: 5, date: '2026-06-02', time: '22:00',
  });
  assert.equal(cup.quantityInCL, 50);

  // drinkCount de la catégorie mis à jour.
  const cat = await dbManager.getCategoryByName('Bière');
  assert.equal(cat.drinkCount, 3);
});

test('getDrinkByUid — retrouve une boisson par uid stable', async () => {
  const all = await dbManager.getAllDrinks();
  const target = all[0];
  const found = await dbManager.getDrinkByUid(target.uid);
  assert.equal(found.id, target.id);
});

test('updateDrink — recalcul quantityInCL et drinkCounts croisés', async () => {
  const all = await dbManager.getAllDrinks();
  const pils = all.find((d) => d.name === 'Pils');
  const upd = await dbManager.updateDrink(pils.id, { quantity: 1, unit: 'L' });
  assert.equal(upd.quantityInCL, 100, 'changement d’unité → recalcul');

  await dbManager.addCategory({ name: 'Vin' });
  await dbManager.updateDrink(pils.id, { category: 'Vin' });
  const biere = await dbManager.getCategoryByName('Bière');
  const vin = await dbManager.getCategoryByName('Vin');
  assert.equal(biere.drinkCount, 2, 'l’ancienne catégorie décrémente');
  assert.equal(vin.drinkCount, 1, 'la nouvelle incrémente');
  await assert.rejects(() => dbManager.updateDrink(99999, { quantity: 1 }), /non trouvée/);
});

test('setSetting(key, null) — SUPPRIME la clé (pas de null fantôme)', async () => {
  await dbManager.setSetting('share.favoriteId', 'user-1');
  assert.equal(await dbManager.getSetting('share.favoriteId'), 'user-1');
  await dbManager.setSetting('share.favoriteId', null);
  assert.equal(await dbManager.getSetting('share.favoriteId'), null);
  const all = await dbManager.getAllSettings();
  assert.ok(!('share.favoriteId' in all), 'la clé a réellement disparu');
  // undefined suit la même convention.
  await dbManager.setSetting('tmp.key', 'x');
  await dbManager.setSetting('tmp.key', undefined);
  assert.ok(!('tmp.key' in (await dbManager.getAllSettings())));
});

test('ratings — set / getAll / delete', async () => {
  await dbManager.setRating('pils', 4);
  let ratings = await dbManager.getAllRatings();
  assert.ok(ratings.some((r) => r.drinkName === 'pils' && r.rating === 4));
  await dbManager.deleteRating('pils');
  ratings = await dbManager.getAllRatings();
  assert.ok(!ratings.some((r) => r.drinkName === 'pils'));
});

test('renameCategory — cascade transactionnelle sur les boissons', async () => {
  await dbManager.renameCategory('Bière', 'Bières');
  const drinks = await dbManager.getAllDrinks();
  assert.ok(drinks.filter((d) => d.category === 'Bières').length >= 2, 'drinks cascadés');
  assert.equal(drinks.filter((d) => d.category === 'Bière').length, 0);
  const renamed = await dbManager.getCategoryByName('Bières');
  assert.ok(renamed);
  // Doublon refusé.
  await assert.rejects(() => dbManager.renameCategory('Vin', 'Bières'), /existe déjà/);
  // old === new → no-op silencieux.
  assert.equal(await dbManager.renameCategory('Vin', 'Vin'), true);
});

test('deleteCategory — refuse si des boissons y vivent encore', async () => {
  const biere = await dbManager.getCategoryByName('Bières');
  await assert.rejects(() => dbManager.deleteCategory(biere.id), /contient des boissons/);
  const vide = await dbManager.addCategory({ name: 'Éphémère' });
  assert.equal(await dbManager.deleteCategory(vide.id), true);
  assert.equal(await dbManager.getCategoryByName('Éphémère'), undefined);
});

test('export / import — round-trip complet, import invalide → rollback', async () => {
  const before = {
    drinks: await dbManager.getAllDrinks(),
    cats: await dbManager.getAllCategories(),
  };
  const json = await dbManager.exportData();
  const parsed = JSON.parse(json);
  assert.equal(parsed.version, '1.0');
  assert.equal(parsed.drinks.length, before.drinks.length);

  // Import d'un JSON invalide → throw, données INTACTES.
  await assert.rejects(() => dbManager.importData('not json'));
  await assert.rejects(() => dbManager.importData('{}'), /invalide/);
  // JSON structurellement cassé (drinks non-array) → la transaction rollback.
  const broken = JSON.stringify({ version: '1.0', categories: [], drinks: 'oops' });
  await assert.rejects(() => dbManager.importData(broken));
  assert.equal((await dbManager.getAllDrinks()).length, before.drinks.length,
    'rollback : aucune boisson perdue');
  assert.equal((await dbManager.getAllCategories()).length, before.cats.length);

  // Round-trip valide.
  assert.equal(await dbManager.importData(json), true);
  assert.equal((await dbManager.getAllDrinks()).length, before.drinks.length);
});

test('clearAllData — ne touche PAS sharedPool / shareOutbox / backups', async () => {
  // Seed des tables de partage + backup.
  await dbManager.upsertSharedDrinks([{
    uid: 'shared-1', groupId: 'g1', authorId: 'a1', tsUtc: 1, updatedAt: 1, deleted: 0,
  }]);
  await dbManager.addOutbox({ uid: 'out-1', op: 'upsert' });
  await dbManager.db.backups.add({ createdAt: new Date(), label: 'test', json: '{}' });

  assert.equal(await dbManager.clearAllData(), true);

  assert.equal((await dbManager.getAllDrinks()).length, 0);
  assert.equal((await dbManager.getAllCategories()).length, 0);
  assert.equal((await dbManager.getAllRatings()).length, 0);
  const settings = await dbManager.getAllSettings();
  assert.equal(settings.language, 'fr', 'defaults ré-initialisés');

  assert.equal((await dbManager.getAllSharedDrinks()).length, 1, 'sharedPool intact');
  assert.equal((await dbManager.getOutbox()).length, 1, 'shareOutbox intact');
  assert.ok(await dbManager.getLatestBackup(), 'backups intacts');
});
