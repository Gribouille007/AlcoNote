// Cycle de vie du groupe : retrait d'un membre (remove_member), purge des
// partants chez les autres (prune par diff membres), détection « je ne suis
// plus membre » (≠ erreur réseau), et re-join avec republication des données.
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

const engine = () => ctx.window.shareEngine;
const dbm = () => ctx.window.dbManager;
const pad2 = (n) => String(n).padStart(2, '0');
const isoToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

test('createGroup : je suis le créateur, le pull initial ne me prend PAS pour un exclu', async () => {
  // Une boisson perso AVANT le groupe : elle doit être publiée au join et
  // survivre à tous les scénarios de sortie.
  await ctx.act(async () => {
    await ctx.window.addDrink({
      name: 'Triple Karmeliet', category: 'Bière', quantity: 33, unit: 'cL',
      alcoholContent: 8.4, date: isoToday(), time: '19:00',
    });
    await engine().setDisplayName('Moi');
    await engine().setEnabled(true);
    await engine().createGroup();
    await ctx.sleep(450);
  });
  const s = engine().state;
  assert.ok(s.groupId, 'groupe actif');
  assert.equal(s.creatorId, s.userId, 'créateur = moi');
  // La self-row du mock (contrat group_members Supabase) protège du faux kick.
  assert.ok(s.members.some((m) => m.userId === s.userId), 'je suis dans members');
  assert.ok(s.members.some((m) => m.displayName === 'Léa'), 'Léa présente');
});

test('removeMember : le retiré disparaît de la liste ET du pool local', async () => {
  await ctx.act(async () => {
    await engine().removeMember('mock-lea');
    await ctx.sleep(200);
  });
  const s = engine().state;
  assert.ok(!s.members.some((m) => m.userId === 'mock-lea'), 'Léa retirée de la liste');
  const pool = await dbm().getAllSharedDrinks();
  assert.ok(!pool.some((r) => r.authorId === 'mock-lea'), 'ses boissons purgées du pool');
  assert.ok(pool.some((r) => r.authorId === 'mock-tom'), 'celles de Tom intactes');
});

test('prune par diff : une ligne orpheline du pool disparaît au pull suivant', async () => {
  // Ligne fantôme d'un auteur qui n'est plus membre (ex. un leave dont le
  // DELETE serveur est invisible au pull incrémental).
  await dbm().upsertSharedDrinks([{
    uid: 'ghost-1', groupId: engine().state.groupId, authorId: 'mock-ghost',
    tsUtc: Date.now(), date: isoToday(), time: '12:00', name: 'Fantôme',
    quantity: 25, unit: 'cL', quantityInCL: 25, alcoholContent: 5,
    category: 'Bière', rating: 0, updatedAt: Date.now(), deleted: false,
  }]);
  await ctx.act(async () => { await engine().refreshNow(); await ctx.sleep(250); });
  const pool = await dbm().getAllSharedDrinks();
  assert.ok(!pool.some((r) => r.uid === 'ghost-1'), 'ligne orpheline purgée');
});

test('une erreur réseau sur members N’EST PAS une exclusion', async () => {
  const tr = ctx.window.getTransport();
  const realPull = tr.pullSince.bind(tr);
  tr.pullSince = async (cursor, opts) => {
    const r = await realPull(cursor, opts);
    return { ...r, members: null, error: { message: 'fetch failed' } };
  };
  await ctx.act(async () => { await engine().refreshNow(); await ctx.sleep(250); });
  assert.ok(engine().state.groupId, 'le groupe survit à l’erreur réseau');
  assert.ok(engine().state.members.length > 0, 'membres conservés');
  tr.pullSince = realPull;
  await ctx.act(async () => { await engine().refreshNow(); await ctx.sleep(250); });
  assert.ok(!engine().state.errorDetail, 'erreur effacée après réparation');
});

test('kick subi : reset local complet, données PERSO intactes', async () => {
  const before = (await dbm().getAllDrinks()).length;
  const s = engine().state;
  await ctx.act(async () => {
    // Le « serveur » me retire (équivalent remove_member par le créateur).
    await ctx.window.getTransport().removeMember(s.groupId, s.userId);
    await engine().refreshNow();
    await ctx.sleep(350);
  });
  assert.equal(engine().state.groupId, null, 'plus de groupe local');
  assert.equal(engine().state.members.length, 0, 'plus de membres');
  assert.equal(engine().state.creatorId, null, 'creatorId purgé');
  assert.equal((await dbm().getAllSharedDrinks()).length, 0, 'pool partagé vidé');
  assert.equal((await dbm().getAllDrinks()).length, before, 'mes boissons perso INTACTES');
  await ctx.clickAria(/Amis/, 300);
  assert.match(ctx.text(), /Créer un groupe|Rejoindre/, 'retour à l’écran d’amorçage');
});

test('re-join : mes données suivent (republication complète du catalogue local)', async () => {
  await ctx.act(async () => {
    await engine().joinGroup('AAAA-AAAA');
    await ctx.sleep(500);
  });
  const s = engine().state;
  assert.ok(s.groupId, 'de retour dans un groupe');
  // Re-join du MÊME groupe mock (le serveur survit à un kick) : le pull
  // reconfirme le créateur d'origine — moi.
  assert.equal(s.creatorId, s.userId, 'créateur reconfirmé par le pull');
  // Le serveur mock doit avoir reçu mon back-catalog (pubindex remis à zéro
  // au join → tout republié), avec un watermark d'envoi récent.
  const srv = JSON.parse(ctx.window.localStorage.getItem('alconote.mock.server'));
  const mine = srv.mine || [];
  assert.ok(mine.some((r) => r.name === 'Triple Karmeliet'), 'ma boisson republiée au re-join');
  const fresh = Date.now() - 60_000;
  assert.ok(mine.every((r) => r.updatedAt > fresh), 'watermark d’envoi récent (visible des autres cursors)');
  assert.ok(s.members.some((m) => m.userId === s.userId), 'ma membership rétablie');
});

test('leave volontaire puis re-join : groupe re-seedé au créateur INCONNU', async () => {
  await ctx.act(async () => {
    await engine().leaveGroup();          // supprime aussi le « serveur » mock
    await ctx.sleep(200);
    await engine().joinGroup('BBBB-BBBB'); // re-seed grp-demo, created_by null
    await ctx.sleep(450);
  });
  const s = engine().state;
  assert.ok(s.groupId, 'de retour dans un groupe');
  assert.equal(s.creatorId, null, 'créateur inconnu → tout membre pourra retirer');
  const srv = JSON.parse(ctx.window.localStorage.getItem('alconote.mock.server'));
  assert.ok((srv.mine || []).some((r) => r.name === 'Triple Karmeliet'),
    'back-catalog republié aussi après un leave volontaire');
});
