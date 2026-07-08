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

  // mL : même conversion que toCl (÷10) — régression : le champ stocké
  // restait non converti (330 au lieu de 33).
  const ml = await dbManager.addDrink({
    name: 'Canette', category: 'Bière', quantity: 330, unit: 'mL',
    alcoholContent: 5, date: '2026-06-02', time: '23:00',
  });
  assert.equal(ml.quantityInCL, 33);

  // drinkCount de la catégorie mis à jour.
  const cat = await dbManager.getCategoryByName('Bière');
  assert.equal(cat.drinkCount, 4);
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
  assert.equal(biere.drinkCount, 3, 'l’ancienne catégorie décrémente');
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

test('import d’un export pré-v5 (sans uid) — uid rétro-rempli sur chaque boisson', async () => {
  // Un export d'avant la v5 n'a pas de uid sur les drinks ; sans backfill,
  // le moteur de partage saute ces lignes pour toujours (reconcile ignore
  // les boissons sans uid).
  const legacy = JSON.stringify({
    version: '1.0',
    categories: [{ name: 'Bière', drinkCount: 2 }],
    drinks: [
      { name: 'Vieille pils', category: 'Bière', quantity: 33, unit: 'cL',
        quantityInCL: 33, alcoholContent: 5, date: '2020-01-01', time: '20:00' },
      { name: 'Vieille blonde', category: 'Bière', quantity: 25, unit: 'cL',
        quantityInCL: 25, alcoholContent: 6, date: '2020-01-02', time: '21:00' },
    ],
  });
  assert.equal(await dbManager.importData(legacy), true);
  const drinks = await dbManager.getAllDrinks();
  assert.equal(drinks.length, 2);
  for (const d of drinks) {
    assert.ok(d.uid, `uid rétro-rempli sur ${d.name}`);
  }
  assert.notEqual(drinks[0].uid, drinks[1].uid, 'uids distincts');
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

// ── Canonicalisation des catégories (NFC + trim) ────────────────────
// La table est vide après clearAllData — on reconstruit un état « hérité »
// où les chaînes de catégorie ont dérivé (NFD, espaces parasites).

const NFD_BIERE = 'Bière'; // « Bière » avec accent combinant (NFD)

test('getCategoryByName — repli canonique (NFD / espaces), undefined sinon', async () => {
  const row = await dbManager.addCategory({ name: 'Bière' });
  const viaNfd = await dbManager.getCategoryByName(NFD_BIERE);
  assert.ok(viaNfd && viaNfd.id === row.id, 'trouvée via la forme NFD');
  const viaSpaces = await dbManager.getCategoryByName('  Bière ');
  assert.ok(viaSpaces && viaSpaces.id === row.id, 'trouvée avec espaces parasites');
  assert.equal(await dbManager.getCategoryByName('Inexistante'), undefined,
    'contrat historique : undefined quand absente');
});

test('RÉGRESSION : renameCategory cascade CANONIQUE (boissons NFD / espaces)', async () => {
  // Deux boissons dont la chaîne catégorie a dérivé : elles doivent suivre le
  // renommage au lieu de rester orphelines sous l'ancien nom (ce qui faisait
  // « réapparaître » la catégorie renommée — bug historique).
  await dbManager.addDrink({
    name: 'Blonde', category: NFD_BIERE, quantity: 33, unit: 'cL',
    alcoholContent: 5, date: '2026-06-05', time: '20:00',
  });
  await dbManager.addDrink({
    name: 'Ambrée', category: 'Bière ', quantity: 25, unit: 'cL',
    alcoholContent: 6, date: '2026-06-05', time: '21:00',
  });
  await dbManager.renameCategory('Bière', 'Mousse');

  const all = await dbManager.getAllDrinks();
  for (const d of all.filter((x) => ['Blonde', 'Ambrée'].includes(x.name))) {
    assert.equal(d.category, 'Mousse', `${d.name} suit le renommage`);
  }
  const mousse = await dbManager.getCategoryByName('Mousse');
  assert.equal(mousse.drinkCount, 2, 'compteur recalculé canoniquement');
});

test('renameCategory — casse/normalisation seule (même ligne) acceptée, vrai doublon refusé', async () => {
  // Même ligne : « Mousse » → « mousse » ne doit PAS être bloqué en doublon.
  await dbManager.renameCategory('Mousse', 'mousse');
  const row = await dbManager.getCategoryByName('mousse');
  assert.equal(row.name, 'mousse', 'renommage de casse appliqué');
  // Vrai doublon (une AUTRE ligne canoniquement identique) : refusé.
  await dbManager.addCategory({ name: 'Cidre' });
  await assert.rejects(() => dbManager.renameCategory('Cidre', ' mousse '), /existe déjà/);
});

test('normalizeCategoryData — normalise, fusionne les doublons, snapshot AVANT', async () => {
  // État hérité fabriqué en écrivant directement dans Dexie (comme les
  // anciennes versions sans trim/normalisation) : deux lignes qui se replient
  // sur le même nom canonique + une surcharge couleur sur la ligne perdante.
  const keeperId = await dbManager.db.categories.add({ name: 'Rhum', drinkCount: 0 });
  const loserId = await dbManager.db.categories.add({ name: 'Rhum ', drinkCount: 0 });
  await dbManager.db.settings.put({ key: `cat.color.id.${loserId}`, value: '123' });
  await dbManager.addDrink({
    name: 'Vieux', category: 'Rhum ', quantity: 4, unit: 'cL',
    alcoholContent: 40, date: '2026-06-06', time: '22:00',
  });

  const backupsBefore = await dbManager.db.backups.count();
  const res = await dbManager.normalizeCategoryData();
  assert.equal(res.changed, true, 'des corrections ont été appliquées');

  const cats = await dbManager.getAllCategories();
  const rhums = cats.filter((c) => c.name.trim().normalize('NFC') === 'Rhum');
  assert.equal(rhums.length, 1, 'doublons fusionnés en une seule ligne');
  assert.equal(rhums[0].id, keeperId, 'la première ligne est conservée');
  assert.equal(rhums[0].name, 'Rhum', 'nom canonique');
  assert.equal(await dbManager.getSetting(`cat.color.id.${keeperId}`), '123',
    'surcharge couleur migrée vers la ligne conservée');
  assert.equal(await dbManager.getSetting(`cat.color.id.${loserId}`), null,
    'surcharge de la ligne perdante purgée');

  const drink = (await dbManager.getAllDrinks()).find((d) => d.name === 'Vieux');
  assert.equal(drink.category, 'Rhum', 'chaîne catégorie de la boisson réécrite');

  assert.equal(await dbManager.db.backups.count(), backupsBefore + 1,
    'snapshot pris avant toute écriture');
  const last = await dbManager.getLatestBackup();
  assert.equal(last.label, 'pre-normalize-categories');

  // Idempotent : un second appel ne trouve plus rien à faire (pas de snapshot).
  const res2 = await dbManager.normalizeCategoryData();
  assert.equal(res2.changed, false, 'second appel = no-op');
  assert.equal(await dbManager.db.backups.count(), backupsBefore + 1, 'pas de snapshot inutile');
});

// ── Durabilité : snapshots automatiques ─────────────────────────────

test('maybeAutoBackup — snapshot quotidien, rotation des « auto » seulement', async () => {
  // Intervalle échu (aucun lastAutoAt) + base non vide (drinks des tests
  // précédents) → un snapshot 'auto' est créé.
  await dbManager.setSetting('backup.lastAutoAt', null);
  const before = (await dbManager.db.backups.toArray()).length;
  assert.equal(await dbManager.maybeAutoBackup(), true, 'snapshot créé');
  const after1 = await dbManager.db.backups.toArray();
  assert.equal(after1.length, before + 1);
  const auto = after1[after1.length - 1];
  assert.equal(auto.label, 'auto');
  const parsed = JSON.parse(auto.json);
  assert.ok(Array.isArray(parsed.drinks) && parsed.drinks.length > 0, 'les boissons sont dedans');

  // Garde-fou d'intervalle : un second appel immédiat est un no-op.
  assert.equal(await dbManager.maybeAutoBackup(), false, 'intervalle non échu → no-op');

  // Rotation : keep=2 → seuls les 2 'auto' les plus récents survivent, les
  // snapshots de migration (labels non-'auto') ne sont JAMAIS purgés.
  const protectedCount = (await dbManager.db.backups.toArray())
    .filter((b) => b.label !== 'auto').length;
  for (let i = 0; i < 3; i++) {
    await dbManager.setSetting('backup.lastAutoAt', null);
    assert.equal(await dbManager.maybeAutoBackup({ keep: 2 }), true);
  }
  const all = await dbManager.db.backups.toArray();
  assert.equal(all.filter((b) => b.label === 'auto').length, 2, 'rotation à 2 snapshots auto');
  assert.equal(all.filter((b) => b.label !== 'auto').length, protectedCount,
    'les snapshots de migration survivent à la rotation');
});

test('ensurePersistentStorage — best-effort sans navigator.storage', async () => {
  const res = await dbManager.ensurePersistentStorage();
  assert.equal(typeof res.persisted, 'boolean', 'contrat de retour stable');
});

test('import / clearAllData — snapshot de sécurité AVANT l’étape destructive', async () => {
  // État courant non vide (les tests précédents ont peuplé la base).
  assert.ok((await dbManager.getAllDrinks()).length > 0, 'base non vide');
  const before = (await dbManager.db.backups.toArray()).length;

  // Import valide (round-trip de l'export courant) → snapshot 'pre-import'.
  const json = await dbManager.exportData();
  await dbManager.importData(json);
  let all = await dbManager.db.backups.toArray();
  assert.equal(all.length, before + 1, 'un snapshot ajouté par l’import');
  assert.equal(all[all.length - 1].label, 'pre-import');

  // « Tout effacer » → snapshot 'pre-clear' AVANT le wipe.
  await dbManager.clearAllData();
  all = await dbManager.db.backups.toArray();
  assert.equal(all.length, before + 2, 'un snapshot ajouté par le clear');
  assert.equal(all[all.length - 1].label, 'pre-clear');
  const parsed = JSON.parse(all[all.length - 1].json);
  assert.ok(parsed.drinks.length > 0, 'le snapshot contient bien les boissons effacées');
  assert.equal((await dbManager.getAllDrinks()).length, 0, 'le wipe a bien eu lieu');
});
