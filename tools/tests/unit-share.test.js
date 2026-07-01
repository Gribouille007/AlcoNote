// Helpers purs du moteur de partage (proto/share.jsx) : minimisation du
// payload publié et watermark d'envoi (régression re-join invisible).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { installStubs, loadDist } = require('./helpers/stub-globals');

installStubs();
// dbManager minimal AVANT share.js : initShare() top-level lit les settings
// (sans ce stub, waitForDb() boucle 4 s avant d'abandonner).
global.dbManager = {
  getSetting: async () => null,
  getAllSettings: async () => ({}),
};
global.SHARE_CONFIG = { TRANSPORT: 'mock', PULL_INTERVAL_MS: 600000 };
loadDist('shared', 'data', 'stats', 'share');

const { localDrinkToShared, tsFromDateTime } = global;

test('localDrinkToShared — payload minimisé : jamais de GPS / barcode / prix', () => {
  const local = {
    uid: 'uid-1', name: 'Chouffe', date: '2026-06-09', time: '21:30',
    quantity: 33, unit: 'cL', quantityInCL: 33, alcoholContent: 8,
    category: 'Bière', price: 6.5, priceIsCustom: true, barcode: '54491472',
    location: { lat: 50.85, lng: 4.35, address: 'Bruxelles' },
    createdAt: '2026-06-09T21:30:00', updatedAt: '2026-06-09T21:31:00',
  };
  const shared = localDrinkToShared(local, 4);
  assert.equal(shared.uid, 'uid-1');
  assert.equal(shared.rating, 4);
  assert.equal(shared.quantityInCL, 33);
  assert.ok(!('location' in shared), 'GPS jamais publié');
  assert.ok(!('barcode' in shared), 'barcode jamais publié');
  assert.ok(!('price' in shared), 'prix jamais publié');
  assert.ok(!('priceIsCustom' in shared), 'flag prix jamais publié');
  assert.equal(shared.deleted, false);
});

test('localDrinkToShared — watermark d’ENVOI = maintenant, pas le updatedAt du drink', () => {
  // Régression re-join : un drink modifié il y a longtemps doit repartir
  // avec un updated_at QUI DÉPASSE le cursor des autres membres, sinon la
  // republication du back-catalog reste invisible à leur pull incrémental.
  const oldEdit = '2024-01-01T10:00:00';
  const before = Date.now();
  const shared = localDrinkToShared({
    uid: 'uid-2', name: 'Vieux vin', date: '2024-01-01', time: '20:00',
    quantity: 12, unit: 'cL', quantityInCL: 12, alcoholContent: 13,
    category: 'Vin', updatedAt: oldEdit,
  }, 0);
  const after = Date.now();
  assert.ok(shared.updatedAt >= before && shared.updatedAt <= after,
    'updatedAt ≈ Date.now() à la publication');
  const friendCursor = +new Date('2025-06-01T00:00:00');
  assert.ok(shared.updatedAt > friendCursor,
    'dépasse un cursor ami plus récent que la vieille édition');
});

test('tsFromDateTime — instant absolu et fallback', () => {
  const ts = tsFromDateTime('2026-06-09', '21:30');
  assert.equal(ts, new Date('2026-06-09T21:30').getTime());
  assert.ok(Number.isFinite(tsFromDateTime('', '')), 'fallback fini sur entrée vide');
});

test('pullFullHistory — hors-ligne : message franc, cursor jamais remis à zéro', async () => {
  const { shareEngine } = global;
  // Régression : hors-ligne, pull() sortait sans errorDetail et le bouton
  // concluait « Historique à jour » alors que rien n'avait été tiré.
  shareEngine.state.groupId = 'grp-test';
  let cursorWrites = 0;
  global.dbManager.setSetting = async (k) => {
    if (String(k).startsWith('share.cursor.')) cursorWrites++;
  };
  global.navigator.onLine = false;
  try {
    const msg = await shareEngine.pullFullHistory();
    assert.match(String(msg), /connecté/i, 'message hors-ligne explicite');
    assert.equal(cursorWrites, 0, 'le cursor n’est pas remis à zéro pour rien');
    assert.equal(shareEngine.state.online, false, 'état réseau reflété');
  } finally {
    global.navigator.onLine = true;
    shareEngine.state.groupId = null;
    shareEngine.state.online = true;
    delete global.dbManager.setSetting;
  }
});
