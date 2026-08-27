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

// ── Codes d'invitation ────────────────────────────────────────────────────
// Un code circule à l'oral, par SMS, en copier-coller depuis une conversation.
// Il ne doit JAMAIS être refusé pour une histoire de casse, de tiret ou
// d'espace : c'est la cause n°1 d'un « rejoindre » qui ne marche pas.

test('normalizeInviteCode — casse, tirets, espaces, invisibles : même code', () => {
  const { normalizeInviteCode } = global;
  const canonical = 'ABCDEFGH';
  for (const raw of ['ABCD-EFGH', 'abcd-efgh', ' ABCD EFGH ', 'abcdefgh',
                     'ABCD—EFGH', 'A B C D E F G H', 'ABCD_EFGH', '\tABCD-efgh\n']) {
    assert.equal(normalizeInviteCode(raw), canonical, `« ${raw} » → ${canonical}`);
  }
  assert.equal(normalizeInviteCode(''), '', 'chaîne vide');
  assert.equal(normalizeInviteCode(null), '', 'null toléré');
  assert.equal(normalizeInviteCode(undefined), '', 'undefined toléré');
  assert.equal(normalizeInviteCode('----'), '', 'que des séparateurs → vide');
});

test('formatInviteCode — forme transmissible XXXX-XXXX, jamais tronquée', () => {
  const { formatInviteCode, normalizeInviteCode } = global;
  assert.equal(formatInviteCode('abcdefgh'), 'ABCD-EFGH', 'tiret réinséré');
  assert.equal(formatInviteCode('ABCD-EFGH'), 'ABCD-EFGH', 'idempotent');
  assert.equal(formatInviteCode(formatInviteCode('ab cd ef gh')), 'ABCD-EFGH', 'stable par ré-application');
  assert.equal(formatInviteCode('ABC'), 'ABC', 'trop court : laissé tel quel');
  assert.equal(formatInviteCode(''), '', 'vide');
  // Un code plus long est groupé, jamais amputé (perdre des caractères
  // rendrait le code invalide en silence).
  assert.equal(formatInviteCode('ABCDEFGHIJ'), 'ABCD-EFGHIJ');
  assert.equal(normalizeInviteCode(formatInviteCode('ABCDEFGHIJ')), 'ABCDEFGHIJ',
    'aller-retour sans perte');
});

test('INVITE_ALPHABET — pas de I/O/0/1 (ambigus), miroir du serveur', () => {
  const { INVITE_ALPHABET } = global;
  for (const ch of ['I', 'O', '0', '1']) {
    assert.ok(!INVITE_ALPHABET.includes(ch), `${ch} exclu de l'alphabet`);
  }
  assert.equal(INVITE_ALPHABET.length, 32);
});

// ── Transport Supabase : ce qui part réellement sur le fil ────────────────

function fakeSupabase({ session = { user: { id: 'user-1' } }, rpcResult } = {}) {
  const calls = { rpc: [], signIn: 0 };
  const client = {
    auth: {
      getSession: async () => ({ data: { session } }),
      signInAnonymously: async () => {
        calls.signIn++;
        return { data: { session: { user: { id: 'user-new' } } }, error: null };
      },
    },
    rpc: async (fn, args) => {
      calls.rpc.push({ fn, args });
      return { data: rpcResult || { group_id: 'grp-1', invite_code: 'ABCD-EFGH' }, error: null };
    },
    from: () => ({ upsert: async () => ({ error: null }) }),
  };
  global.supabase = { createClient: () => client };
  return calls;
}

test('joinGroup (Supabase) — le code part sous la forme STOCKÉE (XXXX-XXXX)', async () => {
  // `invites.token` contient « ABCD-EFGH ». Un backend pas encore migré
  // compare brutalement `token = upper(invite_token)` : envoyer « ABCDEFGH »
  // ne matcherait rien. On envoie donc toujours la forme transmissible, quelle
  // que soit la façon dont l'utilisateur a tapé le code.
  const calls = fakeSupabase();
  const t = global.SupabaseShareTransport({ SUPABASE_URL: 'https://x.supabase.co', SUPABASE_ANON_KEY: 'k' });
  const res = await t.joinGroup('  abcd efgh ');
  assert.deepEqual(calls.rpc[0], { fn: 'join_group', args: { invite_token: 'ABCD-EFGH' } });
  assert.equal(res.groupId, 'grp-1');
  assert.equal(res.inviteCode, 'ABCD-EFGH', 'code confirmé par le serveur');
  delete global.supabase;
});

test('ensureInvite (Supabase) — RPC ensure_invite pour (re)obtenir un code', async () => {
  const calls = fakeSupabase({ rpcResult: { group_id: 'grp-1', invite_code: 'WXYZ-2345' } });
  const t = global.SupabaseShareTransport({ SUPABASE_URL: 'https://x.supabase.co', SUPABASE_ANON_KEY: 'k' });
  const res = await t.ensureInvite('grp-1');
  assert.deepEqual(calls.rpc[0], { fn: 'ensure_invite', args: { p_group_id: 'grp-1' } });
  assert.equal(res.inviteCode, 'WXYZ-2345');
  delete global.supabase;
});

test('ensureIdentity (Supabase) — hors-ligne : JAMAIS de nouvelle identité anonyme', async () => {
  // Régression majeure : sans session récupérable et hors-ligne, forger une
  // identité anonyme remplacerait la mienne — mes lignes serveur appartenant
  // à l'ancien uid, je serais silencieusement sorti de mon groupe.
  const calls = fakeSupabase({ session: null });
  const t = global.SupabaseShareTransport({ SUPABASE_URL: 'https://x.supabase.co', SUPABASE_ANON_KEY: 'k' });
  global.navigator.onLine = false;
  try {
    await assert.rejects(() => t.ensureIdentity(), /offline/i);
    assert.equal(calls.signIn, 0, 'aucune création d’identité hors-ligne');
  } finally {
    global.navigator.onLine = true;
  }
  // En ligne, la même situation crée bien une identité.
  const id = await t.ensureIdentity();
  assert.equal(id.userId, 'user-new');
  assert.equal(calls.signIn, 1);
  delete global.supabase;
});

test('shareErrorMessage — invitation expirée / épuisée / invalide : messages DISTINCTS', () => {
  const { shareErrorMessage } = global;
  const expired = shareErrorMessage(new Error('expired invite'));
  const used = shareErrorMessage(new Error('invite exhausted'));
  const bad = shareErrorMessage(new Error('invalid invite'));
  assert.match(expired, /expirée/i);
  assert.match(used, /épuisée/i);
  assert.match(bad, /invalide/i);
  assert.notEqual(expired, bad, 'une invitation périmée n’est pas une faute de frappe');
  assert.notEqual(used, bad);
  assert.match(shareErrorMessage(new Error('not authenticated')), /session/i);
  assert.match(shareErrorMessage(new Error('not a member')), /groupe/i);
});
