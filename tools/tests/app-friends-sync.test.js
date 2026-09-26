// Moteur de partage — régressions de synchronisation (app réelle, transport
// mock) : pull sérialisé (« Télécharger tout l'historique » pendant un pull
// en vol), départ du groupe PENDANT un pull, file d'envoi d'un ancien groupe,
// cache du pool (pas de relecture IndexedDB sur un bump anodin).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { bootApp } = require('./helpers/boot-app');

let ctx;
test.before(async () => {
  ctx = await bootApp();
  await ctx.waitFor(() => ctx.text().includes('Bière'), { label: 'seed' });
  await ctx.act(async () => {
    await ctx.window.shareEngine.setDisplayName('Moi');
    await ctx.window.shareEngine.setEnabled(true);
    await ctx.window.shareEngine.createGroup();
    await ctx.sleep(450);
  });
});
test.after(() => ctx && ctx.cleanup());

const engine = () => ctx.window.shareEngine;
const dbm = () => ctx.window.dbManager;
const cursorKey = () => `share.cursor.${engine().state.groupId}`;

// Enveloppe pullSince : trace les curseurs demandés et peut retarder la réponse.
function spyPull(delayMs = 0) {
  const tr = ctx.window.getTransport();
  const real = tr.pullSince.bind(tr);
  const calls = [];
  tr.pullSince = async (cursor, opts) => {
    const call = { cursor, startedAt: Date.now(), endedAt: null };
    calls.push(call);
    // Lecture « serveur » D'ABORD, latence ENSUITE (réponse en transit) :
    // c'est pendant ce transit que l'utilisateur peut quitter le groupe.
    const r = await real(cursor, opts);
    if (delayMs) await ctx.sleep(delayMs);
    call.endedAt = Date.now();
    return r;
  };
  return { calls, restore: () => { tr.pullSince = real; } };
}

test('pull sérialisé : un 2e appel attend le 1er au lieu de rendre la main à vide', async () => {
  const spy = spyPull(150);
  let secondDone = false;
  await ctx.act(async () => {
    const p1 = engine().refreshNow();
    await ctx.sleep(20);
    const p2 = engine().refreshNow().then(() => { secondDone = true; });
    await ctx.sleep(40);
    assert.equal(secondDone, false, 'le 2e appel ne se résout pas avant la fin du pull en vol');
    await Promise.all([p1, p2]);
  });
  spy.restore();
  assert.ok(spy.calls.length >= 2, 'une passe supplémentaire a bien eu lieu');
  // Jamais deux pulls en parallèle.
  for (let i = 1; i < spy.calls.length; i++) {
    assert.ok(spy.calls[i].startedAt >= spy.calls[i - 1].endedAt, 'pulls strictement successifs');
  }
});

test('RÉGRESSION : « Télécharger tout l’historique » pendant un pull en vol repart bien de 0', async () => {
  // Curseur non nul (des pulls ont déjà eu lieu).
  assert.ok((await dbm().getSetting(cursorKey())) > 0, 'curseur avancé');
  const spy = spyPull(150);
  let err;
  await ctx.act(async () => {
    const inflight = engine().refreshNow();
    await ctx.sleep(20);
    err = await engine().pullFullHistory();
    await inflight;
  });
  spy.restore();
  assert.equal(err, null, 'pas d’erreur');
  const zero = spy.calls.find((c) => c.cursor === 0);
  assert.ok(zero, 'un pull est reparti du curseur 0');
  const first = spy.calls[0];
  assert.ok(zero.startedAt >= first.endedAt, 'APRÈS la fin du pull en vol (qui aurait réécrit le curseur)');
});

test('RÉGRESSION : quitter le groupe PENDANT un pull ne re-remplit pas le pool', async () => {
  // Curseur à 0 : le pull en vol va rapatrier TOUTES les boissons des amis.
  await dbm().setSetting(cursorKey(), 0);
  const spy = spyPull(150);
  await ctx.act(async () => {
    const inflight = engine().refreshNow();
    // Attendre que la requête soit PARTIE (refreshNow réconcilie d'abord).
    for (let i = 0; i < 100 && spy.calls.length === 0; i++) await ctx.sleep(5);
    assert.ok(spy.calls.length > 0, 'pull en vol');
    await engine().leaveGroup();
    await inflight;
    await ctx.sleep(50);
  });
  spy.restore();
  assert.equal(engine().state.groupId, null, 'groupe quitté');
  const pool = await dbm().getAllSharedDrinks();
  assert.equal(pool.length, 0, 'aucune boisson d’anciens amis réinjectée après la purge');
});

test('RÉGRESSION : la file d’envoi d’un ancien groupe est purgée / ignorée', async () => {
  // Élément résiduel visant un groupe qui n'est plus le mien.
  await dbm().addOutbox({ op: 'upsert', records: [{ uid: 'old-1', groupId: 'grp-ancien', authorId: 'x' }] });
  await ctx.act(async () => { await engine().createGroup(); await ctx.sleep(450); });
  assert.equal((await dbm().getOutbox()).length, 0, 'file vide après flush (élément étranger abandonné)');
  assert.ok(!engine().state.errorDetail, 'aucune erreur d’envoi bloquante');

  // Et un changement/départ de groupe purge la file restante.
  await dbm().addOutbox({ op: 'upsert', records: [{ uid: 'old-2', groupId: engine().state.groupId, authorId: 'x' }] });
  await ctx.act(async () => { await engine().leaveGroup(); await ctx.sleep(50); });
  assert.equal((await dbm().getOutbox()).length, 0, 'file purgée au départ du groupe');
});

test('cache du pool : un bump sans écriture ne relit PAS IndexedDB', async () => {
  await ctx.act(async () => { await engine().createGroup(); await ctx.sleep(450); });
  await ctx.clickAria(/Amis/, 300);
  await ctx.waitFor(() => ctx.text().includes('Léa'), { label: 'liste amis' });
  const real = dbm().getAllSharedDrinks.bind(dbm());
  let reads = 0;
  dbm().getAllSharedDrinks = async () => { reads++; return real(); };
  await ctx.act(async () => {
    // Bumps « anodins » : favori, pseudo… (aucune écriture du pool).
    await engine().toggleFavorite('mock-lea');
    await engine().toggleFavorite('mock-lea');
    ctx.window.shareBus.bump();
    await ctx.sleep(100);
  });
  dbm().getAllSharedDrinks = real;
  assert.equal(reads, 0, 'aucune relecture du sharedPool');
});
