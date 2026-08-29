// Rejoindre un groupe — le chemin le plus fragile du partage (identité +
// réseau + état local). Ces tests couvrent les régressions qui le rendaient
// inopérant : code refusé pour un tiret, session d'authentification perdue,
// pool de l'ancien groupe non purgé, code d'invitation irrécupérable.
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
const db = () => ctx.window.dbManager;
const transport = () => ctx.window.getTransport();
const pad2 = (n) => String(n).padStart(2, '0');
const isoToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

test('code d’invitation : tapé n’importe comment, il arrive canonique au serveur', async () => {
  // Une boisson perso AVANT toute adhésion : elle doit survivre à chaque
  // bascule de groupe (le moteur de partage n'écrit jamais dans mes tables).
  await ctx.act(async () => {
    await ctx.window.addDrink({
      name: 'Triple Karmeliet', category: 'Bière', quantity: 33, unit: 'cL',
      alcoholContent: 8.4, date: isoToday(), time: '19:00',
    });
    await engine().setDisplayName('Moi');
    await engine().setEnabled(true);
    await ctx.sleep(150);
  });

  // Serveur STRICT : n'accepte QUE la forme stockée « ABCD-EFGH ». C'est le
  // comportement d'un backend pas encore migré — le client doit s'y plier.
  const tr = transport();
  const real = tr.joinGroup.bind(tr);
  const seen = [];
  tr.joinGroup = async (code) => {
    seen.push(code);
    if (code !== 'ABCD-EFGH') throw new Error('invalid invite');
    return real(code);
  };
  try {
    await ctx.act(async () => {
      await engine().joinGroup('  abcd efgh ');   // minuscules, espaces, sans tiret
      await ctx.sleep(450);
    });
  } finally { tr.joinGroup = real; }

  assert.deepEqual(seen, ['ABCD-EFGH'], 'code normalisé puis reformaté avant l’envoi');
  const s = engine().state;
  assert.ok(s.groupId, 'groupe rejoint');
  assert.equal(s.inviteCode, 'ABCD-EFGH', 'code mémorisé sous sa forme transmissible');
  assert.equal(await db().getSetting('share.inviteCode'), 'ABCD-EFGH', 'code persisté');
  await ctx.waitFor(() => engine().state.members.some((m) => m.displayName === 'Léa'),
    { label: 'membres du groupe rejoints' });
});

test('code vide ou illisible : refus net, aucun effet de bord', async () => {
  const before = { ...engine().state };
  await assert.rejects(() => engine().joinGroup('   '), /invalid invite/);
  await assert.rejects(() => engine().joinGroup('---'), /invalid invite/);
  await assert.rejects(() => engine().joinGroup(null), /invalid invite/);
  assert.equal(engine().state.groupId, before.groupId, 'groupe courant intact');
  assert.equal(engine().state.inviteCode, before.inviteCode, 'code courant intact');
});

test('session perdue : l’identité est VÉRIFIÉE (et réparée) avant l’adhésion', async () => {
  // Simule le cas réel : `share.userId` survit en base locale alors que la
  // session d'authentification, elle, a été perdue et recréée sous un autre
  // uid. Se fier au cache faisait partir la RPC sans jeton valide.
  const tr = transport();
  const realIdentity = tr.ensureIdentity.bind(tr);
  const staleId = 'uid-perdu';
  engine().state.userId = staleId;
  tr.ensureIdentity = async () => ({ userId: 'uid-repare' });
  try {
    await ctx.act(async () => {
      await engine().joinGroup('ABCD-EFGH');
      await ctx.sleep(400);
    });
  } finally { tr.ensureIdentity = realIdentity; }

  assert.equal(engine().state.userId, 'uid-repare', 'identité du transport adoptée');
  assert.equal(await db().getSetting('share.userId'), 'uid-repare', 'identité réparée persistée');
});

test('backend injoignable pour l’identité : on retombe sur l’identité connue', async () => {
  const tr = transport();
  const realIdentity = tr.ensureIdentity.bind(tr);
  tr.ensureIdentity = async () => { throw new Error('Failed to fetch'); };
  const known = engine().state.userId;
  try {
    await ctx.act(async () => {
      await engine().joinGroup('ABCD-EFGH');
      await ctx.sleep(300);
    });
  } finally { tr.ensureIdentity = realIdentity; }
  assert.equal(engine().state.userId, known, 'identité connue conservée, pas de blocage');
  assert.ok(engine().state.groupId, 'adhésion aboutie malgré la vérification impossible');
});

test('re-join du MÊME groupe : idempotent, le pool des amis est conservé', async () => {
  await ctx.waitFor(async () => (await db().getAllSharedDrinks()).length > 0,
    { label: 'pool partagé alimenté' });
  const before = (await db().getAllSharedDrinks()).length;
  const groupBefore = engine().state.groupId;
  await ctx.act(async () => {
    await engine().joinGroup('ABCD-EFGH');
    await ctx.sleep(400);
  });
  assert.equal(engine().state.groupId, groupBefore, 'même groupe');
  const after = (await db().getAllSharedDrinks()).length;
  assert.ok(after >= before, `pool conservé (${before} → ${after})`);
});

test('changer de groupe : ancien groupe quitté, pool et créateur remis à zéro', async () => {
  const tr = transport();
  const oldGroupId = engine().state.groupId;
  await db().setSetting(`share.cursor.${oldGroupId}`, 4242);
  engine().state.creatorId = engine().state.userId;   // j'étais créateur ici

  const realJoin = tr.joinGroup.bind(tr);
  const realLeave = tr.leaveGroup.bind(tr);
  const realPull = tr.pullSince.bind(tr);
  let leftGroup = null;
  tr.joinGroup = async () => ({ groupId: 'grp-autre', inviteCode: 'WXYZ-2345' });
  tr.leaveGroup = async () => { leftGroup = engine().state.groupId; };
  // Le nouveau groupe est vide mais SAIN : je m'y vois, donc aucun faux
  // « tu as été retiré » ne doit se déclencher.
  tr.pullSince = async () => ({
    drinks: [], profiles: [],
    members: [{ userId: engine().state.userId, displayName: 'Moi', shareBac: false }],
    creatorId: null, authUserId: engine().state.userId, cursor: 0, error: null,
  });
  try {
    await ctx.act(async () => {
      await engine().joinGroup('wxyz 2345');
      await ctx.sleep(450);
    });
  } finally { tr.joinGroup = realJoin; tr.leaveGroup = realLeave; tr.pullSince = realPull; }

  const s = engine().state;
  assert.equal(leftGroup, oldGroupId, 'ancien groupe quitté côté serveur AVANT bascule');
  assert.equal(s.groupId, 'grp-autre', 'nouveau groupe adopté');
  assert.equal(s.inviteCode, 'WXYZ-2345', 'nouveau code');
  assert.equal(s.creatorId, null, 'créateur inconnu tant que le pull ne l’a pas confirmé');
  assert.equal((await db().getAllSharedDrinks()).length, 0, 'pool de l’ancien groupe purgé');
  assert.ok(!(await db().getSetting(`share.cursor.${oldGroupId}`)), 'cursor de l’ancien groupe effacé');
  // Les tables PERSO ne sont jamais touchées par le moteur de partage.
  assert.ok((await db().getAllDrinks()).length > 0, 'mes boissons intactes');
});

test('code d’invitation perdu : ensureInviteCode le récupère auprès du serveur', async () => {
  // Cas réel : réinstallation, ou adhésion faite depuis un autre appareil —
  // le code local manque et plus personne ne peut être invité.
  const tr = transport();
  const realEnsure = tr.ensureInvite ? tr.ensureInvite.bind(tr) : null;
  tr.ensureInvite = async (groupId) => ({ groupId, inviteCode: 'jkmn-6789' });
  engine().state.inviteCode = null;
  await db().setSetting('share.inviteCode', null);
  try {
    const code = await engine().ensureInviteCode();
    assert.equal(code, 'JKMN-6789', 'code récupéré et normalisé pour l’affichage');
  } finally { if (realEnsure) tr.ensureInvite = realEnsure; }
  assert.equal(engine().state.inviteCode, 'JKMN-6789');
  assert.equal(await db().getSetting('share.inviteCode'), 'JKMN-6789', 'code persisté');
});

test('code d’invitation : un backend sans RPC ensure_invite ne casse rien', async () => {
  const tr = transport();
  const realEnsure = tr.ensureInvite;
  delete tr.ensureInvite;                    // backend pas encore migré
  engine().state.inviteCode = 'ABCD-EFGH';
  try {
    assert.equal(await engine().ensureInviteCode({ force: true }), 'ABCD-EFGH',
      'code local conservé, aucune exception');
  } finally { tr.ensureInvite = realEnsure; }
});

test('UI : le champ de code est présent hors groupe ET dans un groupe', async () => {
  await ctx.clickAria(/Amis/, 350);
  // Dans un groupe : la saisie d'un autre code est accessible en un tap.
  assert.ok(engine().state.groupId, 'toujours dans un groupe');
  await ctx.clickText(/Rejoindre un autre groupe/, 250);
  assert.ok(ctx.findInputByAria(/Code d'invitation/), 'champ de code révélé dans le groupe');

  // Hors groupe : l'écran d'amorçage porte le même champ.
  await ctx.act(async () => { await engine().leaveGroup(); await ctx.sleep(350); });
  assert.equal(engine().state.inviteCode, null, 'le code part avec le groupe');
  await ctx.waitFor(() => !!ctx.findInputByAria(/Code d'invitation/),
    { label: 'champ de code sur l’écran d’amorçage' });
  const input = ctx.findInputByAria(/Code d'invitation/);
  await ctx.setInput(input, 'pqrs-2345');
  assert.equal(input.value, 'PQRS-2345', 'le champ normalise la saisie en direct');
});

test('UI : le code du groupe est visible et copiable depuis l’onglet Amis', async () => {
  // Boucle complète : celui qui invite doit trouver le code là où il regarde
  // ses amis, sans aller le chercher dans les Paramètres.
  await ctx.act(async () => {
    await engine().joinGroup('PQRS-2345');
    await ctx.sleep(450);
  });
  await ctx.clickAria(/Amis/, 350);
  await ctx.waitFor(() => ctx.text().includes("Code d'invitation"),
    { label: 'code affiché dans le pied de l’onglet' });
  assert.ok(ctx.text().includes('PQRS-2345'), 'le code lui-même est lisible');

  let copied = null;
  Object.defineProperty(ctx.window.navigator, 'clipboard', {
    value: { writeText: async (v) => { copied = v; } }, configurable: true,
  });
  await ctx.clickAria(/Copier le code d'invitation/, 250);
  assert.equal(copied, 'PQRS-2345', 'un tap copie le code');
});

test('UI : code manquant → il est redemandé au serveur à l’affichage', async () => {
  const tr = transport();
  const realEnsure = tr.ensureInvite.bind(tr);
  let asked = 0;
  tr.ensureInvite = async (groupId) => { asked++; return { groupId, inviteCode: 'TVWX-3456' }; };
  try {
    // Le code disparaît (réinstallation) : l'onglet doit le récupérer seul.
    await ctx.act(async () => {
      engine().state.inviteCode = null;
      await db().setSetting('share.inviteCode', null);
      ctx.window.shareBus.bump();
      await ctx.sleep(400);
    });
    await ctx.waitFor(() => ctx.text().includes('TVWX-3456'),
      { label: 'code récupéré et affiché' });
    assert.ok(asked > 0, 'le serveur a bien été interrogé');
  } finally { tr.ensureInvite = realEnsure; }
});
