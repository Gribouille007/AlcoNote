// Migration Dexie v4 → v5 : zéro perte de données. On pré-seed une base au
// schéma v4 (drink SANS uid), puis on laisse js/database.js (v5) migrer.
// Hérité de la phase A de l'ancien tools/smoke-test.js.
'use strict';
require('fake-indexeddb/auto');
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { installStubs, ROOT } = require('./helpers/stub-globals');

const Dexie = require('dexie');

test('v4 → v5 : drink conservé, uid backfillé, snapshot backups écrit', async () => {
  // ── Pré-seed v1..v4 (réplique du schéma historique) ──
  const pre = new Dexie('AlcoNoteDB');
  pre.version(1).stores({
    categories: '++id, name, drinkCount, createdAt, updatedAt',
    drinks: '++id, name, category, quantity, unit, alcoholContent, date, time, location, barcode, createdAt, updatedAt',
    settings: 'key, value, updatedAt',
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
  await pre.table('settings').put({ key: 'userWeight', value: 72, updatedAt: new Date() });
  await pre.close();

  // ── Boot de la vraie couche DB (v5) ──
  installStubs();
  global.Dexie = Dexie;
  require(path.join(ROOT, 'js', 'database.js'));
  const dbManager = global.window.dbManager;
  await dbManager.db.open();

  // Données conservées.
  const drinks = await dbManager.getAllDrinks();
  assert.equal(drinks.length, 1, 'la boisson v4 est conservée');
  assert.equal(drinks[0].name, 'Vieille Pilsner');
  assert.ok(drinks[0].uid, 'uid backfillé sur la boisson existante');
  assert.equal(await dbManager.getSetting('userWeight'), 72, 'settings conservés');
  const ratings = await dbManager.getAllRatings();
  assert.equal(ratings.length, 1, 'ratings conservés');

  // Snapshot de sécurité écrit AVANT la migration.
  const backup = await dbManager.getLatestBackup();
  assert.ok(backup, 'backup pré-v5 présent');
  assert.equal(backup.label, 'pre-v5');
  const snap = JSON.parse(backup.json);
  assert.equal(snap.reason, 'pre-v5-migration');
  assert.ok(snap.drinks.some((d) => d.name === 'Vieille Pilsner'), 'le snapshot contient les données');
  assert.ok(!snap.drinks[0].uid, 'le snapshot est bien l’état v4 (avant backfill)');

  // La table v5 sharedPool existe et est vide.
  assert.equal((await dbManager.getAllSharedDrinks()).length, 0);
});
