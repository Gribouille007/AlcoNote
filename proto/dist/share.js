/* AUTO-GENERATED from proto/share.jsx — do not edit by hand. */
// share.jsx — Partage entre amis (local-first).
//
// Principe : la PWA reste la source de vérité locale (Dexie, intact). Ce module
//  1) publie un sous-ensemble MINIMISÉ des boissons de l'utilisateur (sans GPS)
//     vers un backend de groupe, et
//  2) recopie les boissons partagées des autres membres dans la table Dexie
//     `sharedPool` (LECTURE SEULE) — jamais dans les tables locales.
// Les stats / le BAC d'un ami sont recalculés EN LOCAL depuis ce pool.
//
// Pas de socket permanente : pull à l'ouverture + auto toutes les 10 min au
// premier plan + bouton « rafraîchir ». Le « live » du BAC est un recalcul
// local contre l'horloge (cf. useFriendsBac, tick 60 s).
//
// Le backend est isolé derrière l'interface `ShareTransport` : MockShareTransport
// (local, pour développer/tester sans réseau) ou SupabaseShareTransport (réel).

const SHARE_CFG = Object.assign({
  TRANSPORT: 'mock',
  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: '',
  PULL_INTERVAL_MS: 10 * 60 * 1000
}, typeof window !== 'undefined' && window.SHARE_CONFIG || {});

// ── petit bus de notification pour l'UI de partage ────────────────────────
const shareBus = (() => {
  const subs = new Set();
  return {
    sub(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
    bump() {
      subs.forEach(fn => {
        try {
          fn();
        } catch (e) {}
      });
    }
  };
})();
function _uid() {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  } catch (e) {}
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

// Alphabet des codes d'invitation : ni I, ni O, ni 0, ni 1 (ambigus à l'oral
// comme à l'écrit). Miroir exact de gen_invite_code() dans supabase/schema.sql.
const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// Forme CANONIQUE d'un code : majuscules, aucun séparateur. Un code circule à
// l'oral, par SMS, en copier-coller depuis une conversation : « ab12-cd34 »,
// « AB12 CD34 » et « AB12CD34 » désignent le MÊME code. Toute comparaison
// passe par ici, et la MÊME normalisation existe côté serveur
// (public.normalize_invite_code, supabase/schema.sql) — un tiret oublié ne
// doit jamais valoir « code invalide ».
function normalizeInviteCode(raw) {
  return String(raw == null ? '' : raw).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

// Forme AFFICHÉE : XXXX-XXXX (groupée, donc lisible et dictable). Ne tronque
// jamais — un code plus long resterait entièrement visible plutôt que mutilé.
function formatInviteCode(raw) {
  const n = normalizeInviteCode(raw);
  return n.length > 4 ? `${n.slice(0, 4)}-${n.slice(4)}` : n;
}

// Code d'invitation court et lisible (évite I/O/0/1).
function _inviteCode() {
  const A = INVITE_ALPHABET;
  let s = '';
  for (let i = 0; i < 8; i++) s += A[Math.floor(Math.random() * A.length)];
  return s.slice(0, 4) + '-' + s.slice(4);
}

// Instant absolu (epoch ms) depuis la date/heure murale locale d'une boisson.
function tsFromDateTime(date, time) {
  const t = new Date(`${date}T${time || '00:00'}`).getTime();
  return Number.isFinite(t) ? t : Date.now();
}

// ── État partagé (lu par l'UI via useShare) ───────────────────────────────
const shareState = {
  ready: false,
  available: SHARE_CFG.TRANSPORT === 'mock' || SHARE_CFG.TRANSPORT === 'supabase' && !!SHARE_CFG.SUPABASE_URL,
  transportKind: SHARE_CFG.TRANSPORT,
  userId: null,
  displayName: '',
  enabled: false,
  shareBac: false,
  groupId: null,
  inviteCode: null,
  creatorId: null,
  // créateur du groupe (groups.created_by) | null = inconnu → tout membre peut retirer
  members: [],
  // [{ userId, displayName, shareBac, bacWeight, bacGender }]
  favoriteId: null,
  // userId de l'ami favori (pastille verte du header) | null
  lastPullAt: 0,
  online: typeof navigator !== 'undefined' ? navigator.onLine !== false : true,
  syncing: false,
  error: null,
  // 'pull' | 'sync' | null (catégorie)
  errorDetail: null // message humain de la dernière erreur (diagnostic UI)
};
function _emit() {
  shareBus.bump();
}

// Traduit une erreur de transport (souvent Supabase) en message court et
// ACTIONNABLE pour l'utilisateur, et log l'erreur complète en console pour le
// debug. Les deux pièges classiques après setup : auth anonyme non activée et
// schéma SQL non exécuté (fonctions RPC absentes).
function shareErrorMessage(e) {
  try {
    console.error('[AlcoNote partage]', e);
  } catch (_) {}
  const msg = String(e && (e.message || e.error_description || e.error) || e || '').toLowerCase();
  const code = (e && (e.code || e.status)) != null ? String(e.code || e.status) : '';
  if (/anonymous|signups? not allowed|sign-?ins? are disabled/.test(msg)) return "Active « Anonymous sign-ins » dans Supabase (Auth › Providers)";
  if (/could not find the function|function .*does not exist|pgrst202|schema cache/.test(msg) || code === '404') return "Exécute supabase/schema.sql dans Supabase (SQL Editor)";
  if (/permission denied|must be owner|insufficient privilege/.test(msg) || code === '42501') return "Droits manquants : ré-exécute supabase/schema.sql (GRANT/RLS)";
  if (/violates row-level security|new row violates/.test(msg) || code === '42501') return "RLS : ré-exécute supabase/schema.sql (policies)";
  if (/relation .*does not exist|undefined table|pgrst205|column .*does not exist|pgrst204/.test(msg) || code === '42p01' || code === '42703') return "Tables/colonnes manquantes : ré-exécute supabase/schema.sql";
  if (/sdk supabase|chargement sdk/.test(msg)) return "SDK Supabase injoignable (vérifie ta connexion / CSP)";
  if (/failed to fetch|networkerror|network request failed|load failed/.test(msg)) return "Réseau indisponible — réessaie";
  if (/invalid api key|jwt|apikey|401/.test(msg) || code === '401') return "Clé Supabase invalide (vérifie share-config.js)";
  // Codes d'invitation : messages DISTINCTS et actionnables. « invalide » sur
  // une invitation périmée envoyait chercher une faute de frappe dans un code
  // pourtant correct (bug historique « rejoindre ne marche plus »).
  if (/expired invite/.test(msg)) return "Invitation expirée — demande un nouveau code à ton ami";
  if (/invite exhausted/.test(msg)) return "Invitation épuisée — demande un nouveau code à ton ami";
  if (/invalid invite/.test(msg)) return "Code d'invitation invalide (8 caractères, ex. ABCD-EFGH)";
  if (/not a member/.test(msg)) return "Tu ne fais pas partie de ce groupe";
  if (/not authenticated|offline: identité/.test(msg)) return "Session de partage à rétablir — réessaie dans un instant";
  if (/invite/.test(msg)) return "Code d'invitation invalide";
  return "Échec partage — voir la console (F12) pour le détail";
}

// ── helpers DB settings (écriture directe, sans bump global 'settings') ────
async function _sget(key) {
  const db = await waitForDb();
  return db ? db.getSetting(key) : null;
}
async function _sset(key, val) {
  const db = await waitForDb();
  if (db) await db.setSetting(key, val);
}

// Index des enregistrements déjà publiés : uid → { u: updatedAt(ms), r: rating }.
// Permet de ne ré-émettre que ce qui a changé et de détecter les suppressions.
async function _loadPubIndex() {
  try {
    return JSON.parse((await _sget('share.pubindex')) || '{}') || {};
  } catch {
    return {};
  }
}
async function _savePubIndex(idx) {
  await _sset('share.pubindex', JSON.stringify(idx));
}

// Carte canonique nom→note (comme RatingsProvider, mais one-shot).
async function _ratingsMap(db) {
  const out = {};
  try {
    const all = await db.getAllRatings();
    for (const r of all) {
      const k = ratingKey(r.drinkName);
      const t = +r.updatedAt || 0;
      if (out[k] == null || t >= (out[k]._t || 0)) out[k] = {
        v: r.rating,
        _t: t
      };
    }
  } catch (e) {}
  const flat = {};
  for (const k in out) flat[k] = out[k].v;
  return flat;
}

// Boisson locale → enregistrement partagé minimisé (sans GPS / barcode).
function localDrinkToShared(d, rating) {
  return {
    uid: d.uid,
    groupId: shareState.groupId,
    authorId: shareState.userId,
    tsUtc: tsFromDateTime(d.date, d.time),
    date: d.date,
    time: d.time,
    name: d.name,
    quantity: d.quantity,
    unit: d.unit,
    quantityInCL: d.quantityInCL,
    alcoholContent: d.alcoholContent || 0,
    category: d.category || 'Autre',
    rating: rating || 0,
    // Watermark d'ENVOI, jamais le updatedAt du drink : au re-join, la
    // republication du back-catalog doit dépasser le cursor `updated_at`
    // des autres membres — des timestamps anciens la rendraient invisible
    // à leur pull incrémental pour toujours. La détection de delta locale
    // reste basée sur drink.updatedAt (share.pubindex), et les tombstones
    // posent déjà Date.now() : même convention partout.
    updatedAt: Date.now(),
    deleted: false
  };
}

// ════════════════════════════════════════════════════════════════════════
//  Transports
// ════════════════════════════════════════════════════════════════════════

// Mock : « serveur » en localStorage. Sur un seul navigateur il ne synchronise
// pas réellement entre appareils, mais il SEED des amis fictifs pour développer
// et tester l'onglet Amis (liste, pastilles BAC live, vue stats d'un ami).
function MockShareTransport() {
  const KEY = 'alconote.mock.server';
  const read = () => {
    try {
      return JSON.parse(localStorage.getItem(KEY) || 'null');
    } catch {
      return null;
    }
  };
  const write = v => {
    try {
      localStorage.setItem(KEY, JSON.stringify(v));
    } catch {}
  };
  function seed(groupId) {
    const now = Date.now();
    const min = 60000,
      hr = 3600000,
      day = 24 * hr;
    let n = 0;
    const mk = (author, name, qty, unit, cl, abv, cat, rating, ms) => {
      const d = new Date(ms);
      return {
        uid: `mock-${author}-${ms}-${(n++).toString(36)}`,
        groupId,
        authorId: author,
        tsUtc: ms,
        date: localDate(d),
        time: localTime(d),
        name,
        quantity: qty,
        unit,
        quantityInCL: cl,
        alcoholContent: abv,
        category: cat,
        rating,
        updatedAt: ms,
        deleted: false
      };
    };
    const lea = [mk('mock-lea', 'La Chouffe', 33, 'cL', 33, 8, 'Bière', 5, now - 35 * min), mk('mock-lea', 'La Chouffe', 33, 'cL', 33, 8, 'Bière', 5, now - 75 * min), mk('mock-lea', 'Spritz', 1, 'EcoCup', 25, 11, 'Cocktail', 4, now - 2 * hr - 20 * min), mk('mock-lea', 'Côtes du Rhône', 12, 'cL', 12, 13, 'Vin', 4, now - 2 * day), mk('mock-lea', 'Mojito', 1, 'EcoCup', 25, 10, 'Cocktail', 3, now - 5 * day), mk('mock-lea', 'La Chouffe', 33, 'cL', 33, 8, 'Bière', 5, now - 6 * day - 2 * hr)];
    const tom = [mk('mock-tom', 'IPA Brewdog', 50, 'cL', 50, 6.5, 'Bière', 4, now - 18 * min), mk('mock-tom', 'Whisky', 4, 'cL', 4, 40, 'Spiritueux', 5, now - 3 * hr), mk('mock-tom', 'IPA Brewdog', 50, 'cL', 50, 6.5, 'Bière', 4, now - 1 * day - 1 * hr), mk('mock-tom', 'Heineken', 25, 'cL', 25, 5, 'Bière', 2, now - 4 * day), mk('mock-tom', 'Rhum', 4, 'cL', 4, 40, 'Spiritueux', 3, now - 8 * day)];
    return {
      groupId,
      members: [{
        userId: 'mock-lea',
        displayName: 'Léa',
        shareBac: true,
        bacWeight: 62,
        bacGender: 'female'
      }, {
        userId: 'mock-tom',
        displayName: 'Tom',
        shareBac: false,
        bacWeight: null,
        bacGender: null
      }],
      drinks: [...lea, ...tom],
      mine: [],
      // Code d'invitation du « serveur » mock : mémorisé pour qu'ensureInvite
      // rende toujours un code (comme la RPC ensure_invite réelle).
      inviteCode: _inviteCode(),
      // Renseigné par createGroup (moi) / laissé null par joinGroup (groupe
      // de démo au créateur inconnu → tout membre peut retirer).
      creatorId: null,
      // Posé par removeMember(moi) : le prochain pull ne me liste plus →
      // le moteur détecte l'exclusion (même signal que Supabase/RLS).
      kickedSelf: false
    };
  }
  return {
    kind: 'mock',
    async ensureIdentity() {
      let id = localStorage.getItem('alconote.mock.uid');
      if (!id) {
        id = _uid();
        localStorage.setItem('alconote.mock.uid', id);
      }
      return {
        userId: id
      };
    },
    async setProfile() {/* no-op en mock (profil local) */},
    async createGroup() {
      const groupId = 'grp-' + _uid().slice(0, 8);
      const srv = seed(groupId);
      srv.creatorId = shareState.userId; // je suis le créateur du groupe mock
      write(srv);
      return {
        groupId,
        inviteCode: srv.inviteCode
      };
    },
    // Le mock accepte DÉLIBÉRÉMENT n'importe quel code : c'est un fixture de
    // développement (amis fictifs Léa/Tom), pas une barrière de sécurité — la
    // validation réelle vit dans la RPC join_group (supabase/schema.sql). Il
    // mémorise en revanche le code fourni, pour qu'ensureInvite le rende.
    async joinGroup(code) {
      // En mock on (re)seed le même groupe de démonstration (créateur inconnu).
      let srv = read();
      if (!srv) {
        srv = seed('grp-demo');
      }
      srv.kickedSelf = false; // revenir dans le groupe ré-active ma membership
      srv.inviteCode = formatInviteCode(code) || srv.inviteCode || _inviteCode();
      write(srv);
      return {
        groupId: srv.groupId,
        inviteCode: srv.inviteCode
      };
    },
    async ensureInvite() {
      const srv = read();
      if (!srv) return {
        inviteCode: null
      };
      if (!srv.inviteCode) {
        srv.inviteCode = _inviteCode();
        write(srv);
      }
      return {
        groupId: srv.groupId,
        inviteCode: srv.inviteCode
      };
    },
    async leaveGroup() {
      try {
        localStorage.removeItem(KEY);
      } catch {}
    },
    // Miroir du RPC remove_member : purge serveur du retiré (drinks +
    // membership). Se retirer soi-même = être exclu (kickedSelf).
    async removeMember(_groupId, userId) {
      const srv = read();
      if (!srv) return;
      if (userId === shareState.userId) {
        srv.kickedSelf = true;
        srv.mine = [];
      } else {
        srv.members = srv.members.filter(m => m.userId !== userId);
        srv.drinks = srv.drinks.filter(d => d.authorId !== userId);
      }
      write(srv);
    },
    async pushUpserts(records) {
      const srv = read();
      if (!srv) return;
      const byUid = new Map(srv.mine.map(r => [r.uid, r]));
      for (const r of records) byUid.set(r.uid, r);
      srv.mine = [...byUid.values()];
      write(srv);
    },
    async pushTombstones(uids) {
      const srv = read();
      if (!srv) return;
      const set = new Set(uids);
      srv.mine = srv.mine.map(r => set.has(r.uid) ? {
        ...r,
        deleted: true,
        updatedAt: Date.now()
      } : r);
      write(srv);
    },
    async pullSince(cursor, {
      withMeta = true
    } = {}) {
      const srv = read();
      if (!srv) {
        return {
          drinks: [],
          profiles: [],
          members: withMeta ? [] : undefined,
          creatorId: withMeta ? null : undefined,
          authUserId: shareState.userId,
          cursor: cursor || 0,
          error: null
        };
      }
      const all = [...srv.drinks, ...srv.mine];
      const fresh = all.filter(r => (r.updatedAt || 0) > (cursor || 0));
      const newCursor = all.reduce((m, r) => Math.max(m, r.updatedAt || 0), cursor || 0);
      // Comme Supabase (group_members contient ma row), la liste inclut MOI —
      // sauf si j'ai été retiré : le moteur s'appuie sur cette absence pour
      // détecter l'exclusion.
      const selfRow = srv.kickedSelf ? [] : [{
        userId: shareState.userId,
        displayName: shareState.displayName || '',
        shareBac: !!shareState.shareBac,
        bacWeight: null,
        bacGender: null
      }];
      const members = [...srv.members, ...selfRow];
      return {
        drinks: fresh,
        profiles: members,
        members: withMeta ? members : undefined,
        creatorId: withMeta ? srv.creatorId || null : undefined,
        authUserId: shareState.userId,
        cursor: newCursor,
        error: null
      };
    },
    async exportRecovery() {
      return {
        kind: 'mock',
        uid: localStorage.getItem('alconote.mock.uid')
      };
    },
    async importRecovery(blob) {
      if (blob && blob.uid) localStorage.setItem('alconote.mock.uid', blob.uid);
    }
  };
}

// Charge le SDK Supabase à la demande (zéro coût en mode mock). jsdelivr est
// déjà autorisé par la CSP script-src.
let _sdkPromise = null;
function ensureSupabaseSdk() {
  if (window.supabase && window.supabase.createClient) return Promise.resolve();
  if (_sdkPromise) return _sdkPromise;
  _sdkPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      _sdkPromise = null;
      reject(new Error('Chargement SDK Supabase échoué'));
    };
    document.head.appendChild(s);
  });
  return _sdkPromise;
}

// Supabase : REST/PostgREST + auth anonyme via le SDK officiel (chargé à la
// demande). N'active PAS le Realtime — on reste en pull (sobriété batterie).
function SupabaseShareTransport(cfg) {
  let client = null;
  async function ensureClient() {
    if (!client) {
      await ensureSupabaseSdk();
      client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true
        }
      });
    }
    return client;
  }
  return {
    kind: 'supabase',
    async ensureIdentity() {
      const sb = await ensureClient();
      const {
        data
      } = await sb.auth.getSession();
      if (data && data.session && data.session.user) return {
        userId: data.session.user.id
      };
      // Aucune session utilisable. HORS-LIGNE on n'en crée SURTOUT pas une
      // nouvelle : signInAnonymously() forgerait une identité différente qui
      // remplacerait la mienne et me sortirait de mon groupe (mes lignes
      // serveur appartiennent à l'ancien uid). On échoue franchement ;
      // ensureIdentityNow retombe sur l'identité en cache et retentera en ligne.
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        throw new Error('offline: identité non vérifiable');
      }
      const res = await sb.auth.signInAnonymously();
      if (res.error) throw res.error;
      const sess = res.data && (res.data.session || res.data);
      const uid = sess && sess.user ? sess.user.id : null;
      if (!uid) throw new Error('not authenticated');
      return {
        userId: uid
      };
    },
    async setProfile(p) {
      const sb = await ensureClient();
      const {
        error
      } = await sb.from('shared_profiles').upsert({
        user_id: p.userId,
        group_id: p.groupId,
        display_name: p.displayName,
        share_enabled: p.shareEnabled,
        share_bac: p.shareBac,
        bac_weight: p.shareBac ? p.bacWeight : null,
        bac_gender: p.shareBac ? p.bacGender : null,
        updated_at: Date.now()
      }, {
        onConflict: 'user_id,group_id'
      });
      if (error) throw error;
    },
    async createGroup() {
      const sb = await ensureClient();
      const {
        data,
        error
      } = await sb.rpc('create_group');
      if (error) throw error;
      return {
        groupId: data.group_id,
        inviteCode: data.invite_code
      };
    },
    async joinGroup(code) {
      const sb = await ensureClient();
      // Le code part sous sa forme TRANSMISSIBLE (XXXX-XXXX) : c'est celle
      // stockée dans `invites.token`, donc la seule qu'un backend pas encore
      // migré (comparaison brute `token = upper(...)`) sait reconnaître. Un
      // backend à jour re-normalise de toute façon les deux côtés.
      const {
        data,
        error
      } = await sb.rpc('join_group', {
        invite_token: formatInviteCode(code)
      });
      if (error) throw error;
      return {
        groupId: data.group_id,
        inviteCode: data.invite_code || code
      };
    },
    // Code d'invitation courant du groupe (créé côté serveur s'il n'en existe
    // plus de valide). Un backend pas encore migré ne connaît pas cette RPC :
    // l'appelant traite l'échec comme « pas de code », sans casser le partage.
    async ensureInvite(groupId) {
      const sb = await ensureClient();
      const {
        data,
        error
      } = await sb.rpc('ensure_invite', {
        p_group_id: groupId
      });
      if (error) throw error;
      return {
        groupId: data.group_id,
        inviteCode: data.invite_code
      };
    },
    async leaveGroup() {
      const sb = await ensureClient();
      const {
        error
      } = await sb.rpc('leave_group', {
        p_group_id: shareState.groupId
      });
      if (error) throw error;
    },
    // Le serveur re-vérifie les droits (créateur, ou tout membre si
    // created_by est NULL) et purge drinks + profil + membership du retiré.
    async removeMember(groupId, userId) {
      const sb = await ensureClient();
      const {
        error
      } = await sb.rpc('remove_member', {
        p_group_id: groupId,
        p_user_id: userId
      });
      if (error) throw error;
    },
    async pushUpserts(records) {
      const sb = await ensureClient();
      const rows = records.map(r => ({
        uid: r.uid,
        group_id: r.groupId,
        author_id: r.authorId,
        ts_utc: r.tsUtc,
        date: r.date,
        time: r.time,
        name: r.name,
        quantity: r.quantity,
        unit: r.unit,
        quantity_in_cl: r.quantityInCL,
        alcohol_content: r.alcoholContent,
        category: r.category,
        rating: r.rating,
        updated_at: r.updatedAt,
        deleted: false
      }));
      const {
        error
      } = await sb.from('shared_drinks').upsert(rows, {
        onConflict: 'uid'
      });
      if (error) throw error;
    },
    async pushTombstones(uids) {
      const sb = await ensureClient();
      const {
        error
      } = await sb.from('shared_drinks').update({
        deleted: true,
        updated_at: Date.now()
      }).in('uid', uids);
      if (error) throw error;
    },
    async pullSince(cursor, {
      withMeta = true
    } = {}) {
      const sb = await ensureClient();
      const gid = shareState.groupId;
      // Méta (profils + membres + créateur) une seule fois par pull : la
      // boucle de drainage multi-pages repasse ici avec withMeta=false et
      // n'interroge alors QUE les boissons (sobriété données mobiles).
      const metaQueries = withMeta ? [sb.from('shared_profiles').select('user_id, display_name, share_bac, bac_weight, bac_gender').eq('group_id', gid), sb.from('group_members').select('user_id, display_name').eq('group_id', gid), sb.from('groups').select('created_by').eq('id', gid).maybeSingle()] : [];
      const [d, p, m, g] = await Promise.all([sb.from('shared_drinks').select('*').eq('group_id', gid).gt('updated_at', cursor || 0).order('updated_at', {
        ascending: true
      }).limit(1000), ...metaQueries]);
      // On NE jette PAS sur la seule erreur des boissons : sinon une erreur de
      // lecture de shared_drinks effacerait aussi la liste des membres (bug :
      // « l'autre ne me voit pas »). On loggue chaque erreur et on renvoie ce
      // qui a réussi ; pull() relance un retry si une erreur subsiste.
      if (d.error) console.warn('[AlcoNote partage] lecture shared_drinks', d.error);
      if (p && p.error) console.warn('[AlcoNote partage] lecture shared_profiles', p.error);
      if (m && m.error) console.warn('[AlcoNote partage] lecture group_members', m.error);
      if (g && g.error) console.warn('[AlcoNote partage] lecture groups', g.error);
      const drinks = (d.data || []).map(r => ({
        uid: r.uid,
        groupId: r.group_id,
        authorId: r.author_id,
        tsUtc: r.ts_utc,
        date: r.date,
        time: r.time,
        name: r.name,
        quantity: r.quantity,
        unit: r.unit,
        quantityInCL: r.quantity_in_cl,
        alcoholContent: r.alcohol_content,
        category: r.category,
        rating: r.rating,
        updatedAt: r.updated_at,
        deleted: !!r.deleted
      }));
      const profById = {};
      for (const pr of p && p.data || []) profById[pr.user_id] = pr;
      // `members: null` quand la requête membres a ÉCHOUÉ : le moteur doit
      // distinguer « liste saine (peut-être sans moi → exclu) » d'une simple
      // erreur réseau/RLS — un [] sur erreur déclencherait un faux « kick ».
      const members = m && !m.error && Array.isArray(m.data) ? m.data.map(mm => {
        const pr = profById[mm.user_id] || {};
        return {
          // Le pseudo vit dans shared_profiles (l'utilisateur le change) ;
          // group_members.display_name reste vide (rempli par aucune RPC).
          userId: mm.user_id,
          displayName: pr.display_name || mm.display_name || '',
          shareBac: !!pr.share_bac,
          bacWeight: pr.bac_weight,
          bacGender: pr.bac_gender
        };
      }) : null;
      // uid de la session locale (aucun appel réseau) : garde-fou du moteur
      // contre un faux « exclu » si la session anonyme a changé entre-temps.
      let authUserId = null;
      try {
        const {
          data: sess
        } = await sb.auth.getSession();
        authUserId = sess && sess.session && sess.session.user ? sess.session.user.id : null;
      } catch (e) {}
      const newCursor = drinks.reduce((mx, r) => Math.max(mx, r.updatedAt || 0), cursor || 0);
      return {
        drinks,
        profiles: members || [],
        members: withMeta ? members : undefined,
        creatorId: withMeta && g && !g.error ? g.data && g.data.created_by || null : undefined,
        authUserId,
        cursor: newCursor,
        error: d.error || m && m.error || p && p.error || null
      };
    },
    async exportRecovery() {
      const sb = await ensureClient();
      const {
        data
      } = await sb.auth.getSession();
      return {
        kind: 'supabase',
        session: data && data.session ? data.session : null
      };
    },
    async importRecovery(blob) {
      if (!blob || !blob.session) return;
      const sb = await ensureClient();
      await sb.auth.setSession({
        access_token: blob.session.access_token,
        refresh_token: blob.session.refresh_token
      });
    }
  };
}
let transport = null;
function getTransport() {
  if (transport) return transport;
  if (SHARE_CFG.TRANSPORT === 'supabase' && SHARE_CFG.SUPABASE_URL) transport = SupabaseShareTransport(SHARE_CFG);else transport = MockShareTransport();
  return transport;
}

// ════════════════════════════════════════════════════════════════════════
//  Moteur de sync
// ════════════════════════════════════════════════════════════════════════
let _recTimer = null,
  _flushTimer = null,
  _pullRetry = null,
  _timer = null;
let _flushing = false;
// Pull SÉRIALISÉ : un seul pull en vol (`_pullPromise`). Un appel pendant ce
// temps ne repart pas en parallèle ni ne rend la main à vide : il demande une
// passe de plus (`_pullRerun`) et attend la même promesse. Avant, un
// « Rafraîchir » ou « Télécharger tout l'historique » pendant un pull auto
// rendait la main tout de suite (toast « à jour » mensonger) et le pull en vol
// réécrivait ensuite le curseur remis à zéro (historique jamais retéléchargé).
let _pullPromise = null,
  _pullRerun = false;

// ── Cache du pool partagé (sharedPool) ────────────────────────────────────
// Chaque bump du shareBus (syncing on/off, online, favori…) relisait TOUTE la
// table sharedPool, dans chaque hook abonné (fiche ami ×2, liste ×1, header ×1)
// puis recalculait les stats/BAC de chacun. Le pool ne change pourtant qu'à
// quelques écritures bien identifiées (pull, retrait, reset) : elles
// incrémentent `_poolVersion`, et la lecture est mise en cache par version,
// groupée par auteur. Les tableaux par auteur sont RÉUTILISÉS tant que leur
// contenu (uid + updatedAt) n'a pas bougé → références stables → les useMemo
// de StatsTab / comparaison ne recalculent rien pour un ami inchangé.
let _poolVersion = 0;
let _poolCache = null; // { version, byAuthor: Map<authorId, drink[]> }
let _poolLoading = null; // { version, promise }
const EMPTY_POOL = Object.freeze([]);
function _touchPool() {
  _poolVersion++;
}
function _samePoolList(a, b) {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].uid !== b[i].uid || a[i].updatedAt !== b[i].updatedAt) return false;
  }
  return true;
}

// Groupement pur (testable) : lignes du pool → Map auteur → boissons vivantes
// au format StatsTab (`id` = uid). `prev` permet de réutiliser les tableaux
// inchangés (stabilité référentielle).
function groupSharedPool(rows, prev = null) {
  const groups = new Map();
  for (const r of rows || []) {
    if (!r || r.deleted || !r.authorId) continue;
    let list = groups.get(r.authorId);
    if (!list) {
      list = [];
      groups.set(r.authorId, list);
    }
    list.push({
      ...r,
      id: r.uid
    });
  }
  const out = new Map();
  for (const [author, list] of groups) {
    list.sort((x, y) => x.uid < y.uid ? -1 : x.uid > y.uid ? 1 : 0);
    const old = prev && prev.get(author);
    out.set(author, old && _samePoolList(old, list) ? old : list);
  }
  return out;
}

// Map auteur → boissons, SI le cache est à jour (sinon null) — lecture
// synchrone pour initialiser un hook sans flash « vide ».
function peekPoolByAuthor() {
  return _poolCache && _poolCache.version === _poolVersion ? _poolCache.byAuthor : null;
}
async function loadPoolByAuthor() {
  const hit = peekPoolByAuthor();
  if (hit) return hit;
  if (_poolLoading && _poolLoading.version === _poolVersion) return _poolLoading.promise;
  const version = _poolVersion;
  const promise = (async () => {
    const db = await waitForDb();
    const rows = db ? await db.getAllSharedDrinks() : [];
    const byAuthor = groupSharedPool(rows, _poolCache ? _poolCache.byAuthor : null);
    // Une écriture survenue pendant la lecture rend ce résultat caduc : on
    // ne le met pas en cache (le bump suivant relira la bonne version).
    if (version === _poolVersion) _poolCache = {
      version,
      byAuthor
    };
    return byAuthor;
  })();
  _poolLoading = {
    version,
    promise
  };
  try {
    return await promise;
  } finally {
    if (_poolLoading && _poolLoading.promise === promise) _poolLoading = null;
  }
}
function scheduleReconcile() {
  clearTimeout(_recTimer);
  _recTimer = setTimeout(reconcile, 600);
}

// Calcule le sortant depuis la DB locale (déclenché par dataBus 'drinks'/'ratings').
// Aucune mutation locale n'est modifiée : on lit l'état et on enfile les deltas.
async function reconcile() {
  if (!shareState.enabled || !shareState.groupId) return;
  try {
    const db = await waitForDb();
    if (!db) return;
    const drinks = await db.getAllDrinks();
    const ratings = await _ratingsMap(db);
    const idx = await _loadPubIndex();
    const upserts = [];
    const seen = new Set();
    for (const d of drinks) {
      if (!d.uid) continue;
      seen.add(d.uid);
      const rating = ratings[ratingKey(d.name)] || 0;
      const u = +new Date(d.updatedAt || d.createdAt || 0) || 0;
      const prev = idx[d.uid];
      if (!prev || prev.u !== u || prev.r !== rating) {
        upserts.push(localDrinkToShared(d, rating));
        idx[d.uid] = {
          u,
          r: rating
        };
      }
    }
    const tombs = [];
    for (const uid of Object.keys(idx)) {
      if (!seen.has(uid)) {
        tombs.push(uid);
        delete idx[uid];
      }
    }
    if (upserts.length) await db.addOutbox({
      op: 'upsert',
      records: upserts
    });
    if (tombs.length) await db.addOutbox({
      op: 'tomb',
      uids: tombs
    });
    await _savePubIndex(idx);
    if (upserts.length || tombs.length) await flushOutbox();
  } catch (e) {
    try {
      console.error('[AlcoNote partage] reconcile', e);
    } catch (_) {}
  }
}
async function flushOutbox(attempt) {
  attempt = attempt || 0;
  if (_flushing || !shareState.enabled || !shareState.groupId) return;
  _flushing = true;
  try {
    const db = await waitForDb();
    const items = await db.getOutbox();
    if (!items.length) {
      _flushing = false;
      return;
    }
    const done = [];
    for (const it of items) {
      // Enregistrements préparés pour un AUTRE groupe (file restée d'avant un
      // changement de groupe) : le serveur les refuserait (RLS) à chaque essai
      // et bloquerait toute la file. On les abandonne — reconcile() a déjà
      // republié tout le catalogue pour le groupe courant.
      if (it.op === 'upsert' && it.records && it.records.some(r => r.groupId !== shareState.groupId)) {
        done.push(it.id);
        continue;
      }
      if (it.op === 'upsert' && it.records && it.records.length) await getTransport().pushUpserts(it.records);else if (it.op === 'tomb' && it.uids && it.uids.length) await getTransport().pushTombstones(it.uids);
      done.push(it.id);
    }
    await db.clearOutbox(done);
    shareState.error = null;
    shareState.errorDetail = null;
  } catch (e) {
    try {
      console.error('[AlcoNote partage] envoi (push) échoué', e);
    } catch (_) {}
    shareState.error = 'sync';
    shareState.errorDetail = shareErrorMessage(e);
    const delay = Math.min(16000, 2000 * Math.pow(2, attempt));
    clearTimeout(_flushTimer);
    _flushTimer = setTimeout(() => {
      _flushing = false;
      flushOutbox(attempt + 1);
    }, delay);
    _emit();
    _flushing = false;
    return;
  }
  _flushing = false;
}
function pull(attempt) {
  if (_pullPromise) {
    _pullRerun = true;
    return _pullPromise;
  }
  _pullPromise = (async () => {
    let a = attempt || 0;
    try {
      do {
        _pullRerun = false;
        await _pullOnce(a);
        a = 0;
      } while (_pullRerun && shareState.enabled && shareState.groupId);
    } finally {
      _pullPromise = null;
    }
  })();
  return _pullPromise;
}
function _schedulePullRetry(attempt) {
  const delay = Math.min(16000, 2000 * Math.pow(2, attempt));
  clearTimeout(_pullRetry);
  _pullRetry = setTimeout(() => pull(attempt + 1), delay);
}
async function _pullOnce(attempt) {
  if (!shareState.enabled || !shareState.groupId) return;
  // Hors-ligne : inutile de tenter un fetch (timeouts longs). On signale
  // l'état ; l'event 'online' relancera le pull automatiquement.
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    if (shareState.online !== false) {
      shareState.online = false;
      _emit();
    }
    return;
  }
  // Groupe AU DÉPART du pull. Chaque await peut voir l'utilisateur quitter ou
  // changer de groupe (leaveGroup / joinGroup / exclusion) : sans ce garde, le
  // pull en vol ré-écrivait dans le sharedPool fraîchement purgé les boissons
  // des ANCIENS amis, et le curseur de l'ancien groupe.
  const gid = shareState.groupId;
  const stale = () => shareState.groupId !== gid;
  let touched = false;
  shareState.syncing = true;
  _emit();
  try {
    await flushOutbox();
    const db = await waitForDb();
    // Boucle de drainage : on enchaîne les pages tant qu'elles sont PLEINES
    // (le transport plafonne à 1000/req). Au 1er sync d'un groupe ⇒ télécharge
    // TOUT l'historique de chacun ; ensuite une seule itération suffit (delta).
    // Plafonnée (MAX_PAGES) pour écarter toute boucle pathologique.
    const PAGE = 1000,
      MAX_PAGES = 100;
    let cursor = (await _sget(`share.cursor.${gid}`)) || 0;
    let members = null,
      creatorId,
      authUserId = null,
      partialErr = null,
      pages = 0;
    for (;;) {
      // Méta (profils / membres / créateur) sur la PREMIÈRE page seulement :
      // les pages suivantes du drainage ne re-téléchargent que les boissons.
      const res = await getTransport().pullSince(cursor, {
        withMeta: pages === 0
      });
      if (stale()) return;
      const incoming = (res.drinks || []).filter(r => r.authorId !== shareState.userId);
      const live = incoming.filter(r => !r.deleted);
      const dead = incoming.filter(r => r.deleted).map(r => r.uid);
      if (live.length) {
        await db.upsertSharedDrinks(live);
        touched = true;
      }
      if (dead.length) {
        await db.deleteSharedByUids(dead);
        touched = true;
      }
      // TOUJOURS mémoriser la dernière liste de membres reçue (appliquée plus
      // bas même en cas d'erreur partielle — sinon une erreur sur
      // shared_drinks ferait « disparaître » les autres membres).
      if (Array.isArray(res.members)) members = res.members;
      if (res.creatorId !== undefined) creatorId = res.creatorId;
      if (res.authUserId) authUserId = res.authUserId;
      const count = (res.drinks || []).length;
      const newCursor = res.cursor || cursor;
      if (stale()) return;
      await _sset(`share.cursor.${gid}`, newCursor);
      pages++;
      const advanced = newCursor > cursor;
      cursor = newCursor;
      if (res.error) {
        partialErr = res.error;
        break;
      }
      if (count < PAGE || !advanced || pages >= MAX_PAGES) break;
    }
    if (stale()) return;
    // Détection d'exclusion + purge des partants — UNIQUEMENT sur une liste
    // de membres SAINE (`members === null` ⇒ la requête membres a échoué :
    // erreur réseau/RLS, on ne touche à rien).
    if (Array.isArray(members)) {
      const memberIds = new Set(members.map(mm => mm.userId));
      // Exclu du groupe ? Sous RLS un non-membre reçoit 0 ligne SANS erreur,
      // alors qu'un membre sain se voit toujours lui-même (sa row est insérée
      // par create_group/join_group). `authUserId` (session locale du
      // transport) confirme l'identité pour écarter le faux positif « la
      // session anonyme a changé entre-temps ».
      const me = shareState.userId;
      if (me && authUserId === me && !memberIds.has(me)) {
        await _resetGroupLocal();
        try {
          if (typeof Toast !== 'undefined' && Toast.show) Toast.show('Tu ne fais plus partie du groupe');
        } catch (e) {}
        return;
      }
      // Boissons d'un membre PARTI (leave volontaire ou retrait) : le serveur
      // a supprimé ses lignes, mais le pull incrémental ne voit jamais un
      // DELETE — sans purge, elles resteraient en cache pour toujours.
      const pool = await db.getAllSharedDrinks();
      if (stale()) return;
      const staleUids = pool.filter(r => !memberIds.has(r.authorId)).map(r => r.uid);
      if (staleUids.length) {
        await db.deleteSharedByUids(staleUids);
        touched = true;
      }
      // Créateur du groupe (droits « Retirer ») : persisté pour l'UI.
      if (creatorId !== undefined && creatorId !== shareState.creatorId) {
        shareState.creatorId = creatorId;
        await _sset('share.creatorId', creatorId);
      }
      shareState.members = members;
    }
    shareState.lastPullAt = Date.now();
    shareState.online = true;
    if (partialErr) {
      // Erreur partielle : on a appliqué ce qui a réussi, on signale + retry.
      try {
        console.error('[AlcoNote partage] lecture partielle', partialErr);
      } catch (_) {}
      shareState.error = 'pull';
      shareState.errorDetail = shareErrorMessage(partialErr);
      _schedulePullRetry(attempt);
      return;
    }
    shareState.error = null;
    shareState.errorDetail = null;
    clearTimeout(_pullRetry);
  } catch (e) {
    if (stale()) return;
    try {
      console.error('[AlcoNote partage] pull', e);
    } catch (_) {}
    shareState.error = 'pull';
    shareState.errorDetail = shareErrorMessage(e);
    _schedulePullRetry(attempt);
  } finally {
    // Pool modifié ⇒ nouvelle version : les hooks relisent au bump ci-dessous.
    if (touched) _touchPool();
    shareState.syncing = false;
    _emit();
  }
}
function startTimer() {
  stopTimer();
  if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
    _timer = setInterval(() => {
      if (document.visibilityState === 'visible') pull();
    }, SHARE_CFG.PULL_INTERVAL_MS || 600000);
  }
}
function stopTimer() {
  if (_timer) {
    clearInterval(_timer);
    _timer = null;
  }
}
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      startTimer();
      if (shareState.enabled && shareState.groupId) pull();
    } else {
      stopTimer();
    }
  });
}

// État réseau : alimente la bannière « pas de connexion » de l'onglet Amis et
// relance un pull dès le retour en ligne (rattrapage delta + drainage).
if (typeof window !== 'undefined') {
  const syncOnline = () => {
    const on = navigator.onLine !== false;
    if (shareState.online === on) return;
    shareState.online = on;
    _emit();
    if (on && shareState.enabled && shareState.groupId) pull();
  };
  window.addEventListener('online', syncOnline);
  window.addEventListener('offline', syncOnline);
}

// Purge LOCALE de tout l'état de groupe : sharedPool, cursor, clés share.*
// de groupe, index de publication, state — sans aucun appel serveur.
// Utilisée par leaveGroup() et par la détection d'exclusion du pull.
// Ne touche JAMAIS aux tables perso (drinks/categories/ratings/settings
// hors clés share.*) — règle d'or du moteur de partage.
async function _resetGroupLocal() {
  // Plus aucun retry/flush programmé pour l'ancien groupe.
  clearTimeout(_pullRetry);
  clearTimeout(_flushTimer);
  const db = await waitForDb();
  if (db) {
    await db.clearSharedPool(); // purge des données des amis
    _touchPool();
    if (shareState.groupId) await _sset(`share.cursor.${shareState.groupId}`, null);
    // File d'envoi : ses enregistrements visent l'ANCIEN groupe (groupId figé
    // à la préparation). Rejoués après un changement de groupe, ils étaient
    // refusés (RLS) et bloquaient la file pour toujours. Rien n'est perdu :
    // la file est DÉRIVÉE des boissons locales, et l'index de publication
    // remis à zéro ci-dessous fait tout republier au prochain groupe.
    try {
      const pending = await db.getOutbox();
      if (pending && pending.length) await db.clearOutbox(pending.map(it => it.id));
    } catch (e) {/* best-effort : flushOutbox filtre aussi par groupe */}
  }
  await _sset('share.groupId', null);
  await _sset('share.inviteCode', null);
  await _sset('share.favoriteId', null); // le favori quitte avec le groupe
  await _sset('share.creatorId', null);
  await _savePubIndex({});
  shareState.groupId = null;
  shareState.inviteCode = null;
  shareState.members = [];
  shareState.favoriteId = null;
  shareState.creatorId = null;
  stopTimer();
  _emit();
}

// Crée OU VÉRIFIE l'identité (anonyme) à la demande — jamais au boot si le
// partage est désactivé, pour ne pas créer un compte anonyme inutile à chaque
// ouverture.
//
// On interroge le transport à CHAQUE appel, même quand un userId est déjà en
// mémoire : `share.userId` n'est qu'un cache Dexie, qui survit à la perte de
// la session d'authentification (jeton périmé non rafraîchissable, stockage
// du navigateur purgé, identité restaurée depuis une clé de récup.). Se fier
// au cache laissait alors partir les RPC SANS jeton — `auth.uid()` NULL côté
// serveur, donc « rejoindre un groupe » échouait pour toujours avec une
// erreur opaque. Côté Supabase la vérification est locale (getSession) : ce
// n'est un aller-retour réseau qu'à la (re)création de l'identité.
async function ensureIdentityNow() {
  let userId = null;
  try {
    const res = await getTransport().ensureIdentity();
    userId = res && res.userId || null;
  } catch (e) {
    // Backend injoignable : on retombe sur l'identité connue plutôt que de
    // bloquer, et on laisse remonter si on n'en a aucune (l'UI affichera un
    // message actionnable au lieu d'un échec muet).
    if (shareState.userId) return shareState.userId;
    throw e;
  }
  if (!userId) {
    if (shareState.userId) return shareState.userId;
    throw new Error('not authenticated');
  }
  if (userId !== shareState.userId) {
    shareState.userId = userId;
    await _sset('share.userId', userId);
    _emit();
  }
  return userId;
}

// Code d'invitation COURANT du groupe, garanti tant qu'on en est membre.
// Le code stocké localement n'est qu'un CACHE : il disparaît à la
// réinstallation, et il est absent d'un appareil qui a rejoint sans jamais
// créer de groupe. Sans lui plus personne ne peut être invité — et un groupe
// dont l'invitation avait péri devenait définitivement fermé. On le redemande
// donc au serveur, qui en crée un si aucune invitation valide ne subsiste.
// Best-effort : un backend pas encore migré (RPC ensure_invite absente)
// laisse simplement le code local en place.
async function ensureInviteCode({
  force = false
} = {}) {
  if (!shareState.groupId) return null;
  if (shareState.inviteCode && !force) return shareState.inviteCode;
  const t = getTransport();
  if (typeof t.ensureInvite !== 'function') return shareState.inviteCode || null;
  let code = null;
  try {
    const res = await t.ensureInvite(shareState.groupId);
    code = res && res.inviteCode ? formatInviteCode(res.inviteCode) : null;
  } catch (e) {
    try {
      console.warn('[AlcoNote partage] code d’invitation indisponible', e);
    } catch (_) {}
    return shareState.inviteCode || null;
  }
  if (code && code !== shareState.inviteCode) {
    shareState.inviteCode = code;
    await _sset('share.inviteCode', code);
    _emit();
  }
  return shareState.inviteCode || null;
}

// ── Profil (mon profil partagé : pseudo + paramètres BAC opt-in) ──────────
async function publishMyProfile() {
  if (!shareState.enabled || !shareState.groupId) return;
  try {
    const db = await waitForDb();
    const settings = await db.getAllSettings();
    await getTransport().setProfile({
      userId: shareState.userId,
      groupId: shareState.groupId,
      displayName: shareState.displayName,
      shareEnabled: shareState.enabled,
      shareBac: shareState.shareBac,
      bacWeight: shareState.shareBac ? Number(settings.userWeight) || null : null,
      bacGender: shareState.shareBac ? settings.userGender || null : null
    });
  } catch (e) {
    // best-effort, mais on trace : un échec ici = pseudo/BAC non publiés
    // (les amis te verraient « Anonyme »).
    try {
      console.warn('[AlcoNote partage] publication du profil échouée', e);
    } catch (_) {}
  }
}

// ════════════════════════════════════════════════════════════════════════
//  API publique (consommée par friends.jsx et SettingsDrawer)
// ════════════════════════════════════════════════════════════════════════
const shareEngine = {
  state: shareState,
  isAvailable: () => shareState.available,
  // Le bouton « Rafraîchir » pousse aussi les boissons locales pas encore
  // publiées (reconcile) avant de tirer celles des amis — auto-réparateur si
  // un push avait échoué. Retourne le détail d'erreur éventuel (pour un toast).
  refreshNow: async () => {
    await reconcile();
    await pull();
    return shareState.errorDetail;
  },
  // Re-télécharge TOUT l'historique partagé du groupe depuis zéro : on remet le
  // curseur à 0 puis on relance le pull (la boucle de drainage récupère toutes
  // les pages). Idempotent (upserts par `uid`). Utilisé par le bouton manuel
  // « Télécharger tout l'historique » sur la fiche d'un ami — utile quand le
  // curseur a déjà dépassé d'anciennes boissons d'un membre.
  pullFullHistory: async () => {
    if (!shareState.groupId) return shareState.errorDetail;
    // Hors-ligne, pull() sort immédiatement SANS poser d'errorDetail : le
    // bouton concluait « Historique à jour » alors que rien n'a été tiré.
    // On répond franchement (et on ne remet pas le cursor à zéro pour rien).
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      shareState.online = false;
      _emit();
      return "Vous n'êtes pas connecté·e à Internet";
    }
    clearTimeout(_pullRetry);
    // Un pull déjà en vol réécrirait le curseur APRÈS notre remise à zéro :
    // on le laisse d'abord se terminer.
    if (_pullPromise) {
      try {
        await _pullPromise;
      } catch (e) {}
    }
    if (!shareState.groupId) return shareState.errorDetail;
    await _sset(`share.cursor.${shareState.groupId}`, 0);
    await reconcile(); // pousse aussi mon back-catalog au passage (auto-réparateur)
    await pull();
    return shareState.errorDetail;
  },
  async setDisplayName(name) {
    shareState.displayName = (name || '').trim();
    await _sset('share.displayName', shareState.displayName);
    _emit();
    publishMyProfile();
  },
  async setEnabled(on) {
    shareState.enabled = !!on;
    await _sset('share.enabled', shareState.enabled);
    _emit();
    if (shareState.enabled) {
      await ensureIdentityNow();
      startTimer();
      await publishMyProfile();
      scheduleReconcile();
      pull();
    } else {
      stopTimer();
    }
  },
  async setShareBac(on) {
    shareState.shareBac = !!on;
    await _sset('share.shareBac', shareState.shareBac);
    _emit();
    publishMyProfile();
  },
  // Favori = préférence PUREMENT LOCALE (rien n'est publié au groupe). Bascule
  // l'ami `userId` en favori (ou le retire si déjà favori). Stocké en setting
  // `share.favoriteId` (null ⇒ la clé est supprimée). La pastille verte du
  // header (HeaderBacStack) ré-affiche via le bump.
  async toggleFavorite(userId) {
    const next = shareState.favoriteId === userId ? null : userId || null;
    shareState.favoriteId = next;
    await _sset('share.favoriteId', next);
    _emit();
  },
  async createGroup() {
    await ensureIdentityNow();
    const {
      groupId,
      inviteCode
    } = await getTransport().createGroup();
    shareState.groupId = groupId;
    shareState.inviteCode = inviteCode ? formatInviteCode(inviteCode) : null;
    // Je viens de créer le groupe : j'en suis le créateur (le pull le
    // reconfirmera depuis groups.created_by).
    shareState.creatorId = shareState.userId;
    await _sset('share.groupId', groupId);
    if (shareState.inviteCode) await _sset('share.inviteCode', shareState.inviteCode);
    await _sset('share.creatorId', shareState.creatorId);
    _emit();
    await publishMyProfile();
    // Première publication de TOUT l'historique local (index vide). Synchrone
    // (await reconcile) AVANT le pull pour éviter la course où le 1er pull part
    // alors que le back-catalog n'est pas encore enfilé/poussé (sinon les autres
    // ne voient que mon delta). reconcile() enfile + flush.
    await _savePubIndex({});
    await reconcile();
    startTimer();
    pull();
    // Filet : si le backend n'a pas renvoyé de code, on en obtient un tout de
    // suite — un groupe sans code d'invitation est un groupe qu'on ne peut
    // rejoindre d'aucune façon.
    if (!shareState.inviteCode) ensureInviteCode({
      force: true
    }).catch(() => {});
    return {
      groupId,
      inviteCode: shareState.inviteCode
    };
  },
  // Rejoindre un groupe depuis un code d'invitation. Chemin le plus fragile du
  // partage : il combine identité, réseau et état local. Chaque étape est donc
  // explicitement blindée.
  async joinGroup(code) {
    // 1. Le code est normalisé AVANT tout appel : casse, tirets et espaces
    //    d'un copier-coller ne doivent jamais faire échouer une adhésion.
    const norm = normalizeInviteCode(code);
    if (!norm) throw new Error('invalid invite');
    // 2. Identité VÉRIFIÉE (pas seulement lue en cache) : sans jeton valide la
    //    RPC partirait anonyme et le serveur la refuserait (auth.uid() NULL).
    await ensureIdentityNow();
    const prevGroupId = shareState.groupId;
    // Le transport reçoit la forme TRANSMISSIBLE (XXXX-XXXX), celle qui est
    // stockée côté serveur — cf. SupabaseShareTransport.joinGroup.
    const res = await getTransport().joinGroup(formatInviteCode(norm));
    const groupId = res && res.groupId;
    if (!groupId) throw new Error('invalid invite');
    // 3. Changement de groupe : on quitte proprement l'ANCIEN (serveur puis
    //    purge locale) avant d'adopter le nouveau. Sans ça le sharedPool
    //    garderait les boissons des anciens amis, et le cursor de l'ancien
    //    groupe traînerait dans les settings.
    if (prevGroupId && prevGroupId !== groupId) {
      try {
        await getTransport().leaveGroup();
      } catch (e) {
        try {
          console.warn('[AlcoNote partage] sortie de l’ancien groupe', e);
        } catch (_) {}
      }
      await _resetGroupLocal();
    }
    shareState.groupId = groupId;
    shareState.inviteCode = formatInviteCode(res.inviteCode || norm);
    // Créateur INCONNU tant que le pull ne l'a pas reconfirmé depuis
    // groups.created_by : garder celui de l'ancien groupe afficherait à tort
    // le panneau d'administration.
    shareState.creatorId = null;
    await _sset('share.groupId', groupId);
    await _sset('share.creatorId', null);
    if (shareState.inviteCode) await _sset('share.inviteCode', shareState.inviteCode);
    _emit();
    await publishMyProfile();
    // 4. Le code accepté par le serveur EST désormais mon code à transmettre
    //    (pas de refresh forcé : il vient d'être validé, aller en chercher un
    //    autre ne ferait que remplacer un code valide par un autre).
    //    Publie TOUT mon historique au groupe (index vide ⇒ tout « nouveau »),
    //    synchrone AVANT le pull (cf. createGroup) — sinon les autres membres
    //    ne verraient que mon delta après l'arrivée.
    await _savePubIndex({});
    await reconcile();
    startTimer();
    pull();
    return {
      groupId
    };
  },
  ensureInviteCode,
  async leaveGroup() {
    // Le serveur supprime MES lignes (leave_group) ; les autres appareils
    // les purgent par diff de membres à leur prochain pull.
    try {
      await getTransport().leaveGroup();
    } catch (e) {}
    await _resetGroupLocal();
  },
  // Retire `userId` du groupe — créateur uniquement, ou tout membre quand le
  // créateur est inconnu (le serveur RE-vérifie ces droits dans tous les
  // cas). Purge serveur via RPC, puis écho local immédiat (liste + pool)
  // sans attendre le prochain pull. Laisse remonter l'erreur à l'UI (toast).
  async removeMember(userId) {
    if (!shareState.groupId || !userId) return;
    await getTransport().removeMember(shareState.groupId, userId);
    const db = await waitForDb();
    if (db) {
      const pool = await db.getAllSharedDrinks();
      const uids = pool.filter(r => r.authorId === userId).map(r => r.uid);
      if (uids.length) {
        await db.deleteSharedByUids(uids);
        _touchPool();
      }
    }
    shareState.members = shareState.members.filter(m => m.userId !== userId);
    if (shareState.favoriteId === userId) {
      shareState.favoriteId = null;
      await _sset('share.favoriteId', null);
    }
    _emit();
  },
  async exportRecovery() {
    const t = await getTransport().exportRecovery();
    return {
      v: 1,
      userId: shareState.userId,
      displayName: shareState.displayName,
      groupId: shareState.groupId,
      transport: t
    };
  },
  async importRecovery(blob) {
    if (!blob) return;
    if (blob.transport) {
      try {
        await getTransport().importRecovery(blob.transport);
      } catch (e) {}
    }
    if (blob.userId) {
      shareState.userId = blob.userId;
      await _sset('share.userId', blob.userId);
    }
    if (blob.displayName) {
      shareState.displayName = blob.displayName;
      await _sset('share.displayName', blob.displayName);
    }
    if (blob.groupId) {
      shareState.groupId = blob.groupId;
      await _sset('share.groupId', blob.groupId);
    }
    _emit();
    if (shareState.enabled && shareState.groupId) {
      startTimer();
      pull();
    }
  }
};

// ── Initialisation ────────────────────────────────────────────────────────
async function initShare() {
  try {
    const db = await waitForDb();
    if (!db) return;
    shareState.userId = await db.getSetting('share.userId');
    shareState.displayName = (await db.getSetting('share.displayName')) || '';
    shareState.enabled = !!(await db.getSetting('share.enabled'));
    shareState.shareBac = !!(await db.getSetting('share.shareBac'));
    shareState.groupId = await db.getSetting('share.groupId');
    shareState.inviteCode = await db.getSetting('share.inviteCode');
    shareState.favoriteId = (await db.getSetting('share.favoriteId')) || null;
    shareState.creatorId = (await db.getSetting('share.creatorId')) || null;
    // N'amorce l'identité au boot que pour un utilisateur déjà actif ; sinon
    // on attend qu'il active le partage (évite un compte anonyme inutile).
    // Pour un utilisateur ACTIF on la VÉRIFIE à chaque boot, même si un
    // userId est en cache : c'est là qu'on répare une session perdue, avant
    // que le premier pull ou une adhésion ne parte sans jeton.
    if (shareState.enabled) {
      try {
        await ensureIdentityNow();
      } catch (e) {/* réessayé à l'activation */}
    }
    shareState.ready = true;
    _emit();

    // Re-pousse les paramètres BAC si le poids/sexe local change.
    if (window.dataBus && window.dataBus.sub) {
      window.dataBus.sub(ch => {
        if (ch === 'drinks' || ch === 'ratings' || ch == null) scheduleReconcile();
        if (ch === 'settings' && shareState.enabled && shareState.shareBac) publishMyProfile();
      });
    }
    if (shareState.enabled && shareState.groupId) {
      startTimer();
      pull();
      scheduleReconcile();
      // Code d'invitation manquant (réinstallation, adhésion depuis un autre
      // appareil, groupe créé avant la RPC ensure_invite) : on le récupère en
      // silence, sinon l'utilisateur n'a plus rien à transmettre pour qu'on
      // le rejoigne.
      if (!shareState.inviteCode) ensureInviteCode().catch(() => {});
      // Cicatrisation « une seule fois » : les membres déjà dans un groupe AVANT
      // le correctif de publication n'avaient jamais poussé leur back-catalog.
      // On republie tout l'historique une fois (index vidé ⇒ tout « nouveau »),
      // avec des timestamps courants ⇒ remonte dans le delta des autres sans
      // action de leur part. Gardé par un flag setting pour ne le faire qu'une fois.
      (async () => {
        try {
          if (!(await _sget('share.fullResync.v1'))) {
            await _savePubIndex({});
            await reconcile();
            await _sset('share.fullResync.v1', 1);
          }
        } catch (_) {/* best-effort */}
      })();
    }
  } catch (e) {/* best-effort */}
}
initShare();

// ════════════════════════════════════════════════════════════════════════
//  Hooks React
// ════════════════════════════════════════════════════════════════════════
function useShare() {
  const [, force] = React.useReducer(x => x + 1, 0);
  React.useEffect(() => shareBus.sub(force), []);
  return shareState;
}

// Membres du groupe (hors moi).
function useGroupMembers() {
  const s = useShare();
  return React.useMemo(() => (s.members || []).filter(m => m.userId !== s.userId), [s.members, s.userId]);
}

// Ami favori résolu (objet membre) ou null. Résolution PARESSEUSE : on lit
// `favoriteId` et on le cherche dans les membres courants. Si l'ami a quitté le
// groupe (ou un pull partiel a momentanément vidé la liste), on renvoie null
// sans effacer le choix — il réapparaît dès qu'il revient. Seul `leaveGroup`
// (action volontaire) persiste l'effacement.
function useFavoriteFriend() {
  const s = useShare();
  const members = useGroupMembers();
  // On exige `shareBac` : la pastille verte montre un TAUX. Si l'ami favori
  // coupe le partage de son BAC, la pastille disparaît (plutôt que « — »), et
  // réapparaît s'il le réactive — le choix `favoriteId` n'est pas effacé.
  // On exige aussi `enabled && groupId` : couper le partage (sans quitter le
  // groupe) laisse `members` en mémoire ; sans ce garde-fou la pastille du
  // header survivrait alors que l'onglet Amis, lui, masque déjà la liste.
  return React.useMemo(() => s.enabled && s.groupId && s.favoriteId ? members.find(m => m.userId === s.favoriteId && m.shareBac) || null : null, [s.enabled, s.groupId, s.favoriteId, members]);
}

// Boissons partagées d'un membre (depuis le cache du sharedPool), forme
// compatible StatsTab, + `loading` tant que la 1re lecture n'est pas faite
// (la fiche ami ne flashe plus « aucune donnée » avant l'arrivée des boissons).
// Un bump du shareBus sans écriture du pool ne coûte RIEN : cache à jour →
// même tableau → setState identique → React n'effectue aucun rendu.
function useSharedPool(authorId) {
  const read = () => {
    const m = peekPoolByAuthor();
    return m ? {
      drinks: authorId && m.get(authorId) || EMPTY_POOL,
      loading: false
    } : {
      drinks: EMPTY_POOL,
      loading: true
    };
  };
  const [state, setState] = React.useState(read);
  React.useEffect(() => {
    let alive = true;
    const load = async () => {
      const m = await loadPoolByAuthor();
      if (!alive) return;
      const drinks = authorId && m.get(authorId) || EMPTY_POOL;
      setState(prev => prev.drinks === drinks && !prev.loading ? prev : {
        drinks,
        loading: false
      });
    };
    load();
    const off = shareBus.sub(load);
    return () => {
      alive = false;
      off();
    };
  }, [authorId]);
  return state;
}
function useSharedDrinks(authorId) {
  return useSharedPool(authorId).drinks;
}

// Notes partagées → carte canonique nom→note (pour RatingsContext). Pur.
// La note publiée voyage avec CHAQUE boisson : on garde celle de l'entrée la
// plus récemment publiée (updatedAt), pas la dernière itérée au hasard.
function sharedRatingsMap(drinks) {
  const best = {};
  for (const d of drinks || []) {
    if (!d.rating) continue;
    const k = ratingKey(d.name);
    const t = +d.updatedAt || 0;
    if (!best[k] || t >= best[k].t) best[k] = {
      v: d.rating,
      t
    };
  }
  const out = {};
  for (const k in best) out[k] = best[k].v;
  return out;
}
function useSharedRatings(authorId) {
  const drinks = useSharedDrinks(authorId);
  return React.useMemo(() => sharedRatingsMap(drinks), [drinks]);
}

// Taux courant de chaque membre (pur) : null si le BAC n'est pas partagé.
function friendsBacMap(members, byAuthor) {
  const out = {};
  for (const m of members || []) {
    if (!m || !m.userId) continue;
    if (!m.shareBac) {
      out[m.userId] = null;
      continue;
    }
    const ds = byAuthor && byAuthor.get(m.userId) || EMPTY_POOL;
    if (ds.length === 0 || typeof computeBacOverTime !== 'function') {
      out[m.userId] = 0;
      continue;
    }
    const info = computeBacOverTime(ds, Number(m.bacWeight) || undefined, m.bacGender || 'male');
    out[m.userId] = info.current || 0;
  }
  return out;
}
function _sameBacMap(a, b) {
  const ka = Object.keys(a),
    kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) if (a[k] !== b[k]) return false;
  return true;
}

// BAC courant de chaque membre (recalcul local, tick 60 s). null si pas opt-in.
// Recalcule au tick (le temps passe), quand la liste/profil des membres change
// (clé), ou quand le POOL change (version) — plus à chaque bump anodin du bus.
// Initialisé de façon synchrone depuis le cache : la pastille n'affiche plus
// « — » une frame avant son taux.
function useFriendsBac(members) {
  // La clé encode aussi poids/sexe : un ami qui change son profil (republié au
  // pull) doit recalculer son BAC, pas rester figé sur l'ancienne closure.
  const key = (members || []).map(m => `${m.userId}:${m.shareBac ? 1 : 0}:${m.bacWeight || ''}:${m.bacGender || ''}`).join(',');
  const membersRef = React.useRef(members);
  membersRef.current = members;
  const [map, setMap] = React.useState(() => {
    const cached = peekPoolByAuthor();
    return cached && members && members.length ? friendsBacMap(members, cached) : {};
  });
  React.useEffect(() => {
    // Aucun membre à évaluer (ex. header sans favori) : on évite le timer 60 s
    // et la lecture IndexedDB inutiles, et on repart d'une map vide.
    if (!membersRef.current || membersRef.current.length === 0) {
      setMap(prev => Object.keys(prev).length ? {} : prev);
      return;
    }
    let alive = true;
    let lastVersion = -1;
    const compute = async force => {
      if (!force && lastVersion === _poolVersion) return;
      const version = _poolVersion;
      const byAuthor = await loadPoolByAuthor();
      if (!alive) return;
      lastVersion = version;
      const next = friendsBacMap(membersRef.current, byAuthor);
      setMap(prev => _sameBacMap(prev, next) ? prev : next);
    };
    compute(true);
    const id = setInterval(() => compute(true), 60000);
    const off = shareBus.sub(() => compute(false));
    return () => {
      alive = false;
      clearInterval(id);
      off();
    };
  }, [key]);
  return map;
}

// Ordre d'affichage STABLE des membres (pur) : favori d'abord, puis ordre
// alphabétique (fr, sans casse/accents), userId en départage. L'ordre brut
// du serveur changeait d'un pull à l'autre — la liste « sautait ».
function sortGroupMembers(members, favoriteId = null) {
  const name = m => m.displayName || 'Anonyme';
  return [...(members || [])].sort((a, b) => {
    const fa = a.userId === favoriteId ? 0 : 1;
    const fb = b.userId === favoriteId ? 0 : 1;
    if (fa !== fb) return fa - fb;
    const c = name(a).localeCompare(name(b), 'fr', {
      sensitivity: 'base'
    });
    if (c) return c;
    return String(a.userId).localeCompare(String(b.userId));
  });
}
Object.assign(window, {
  shareEngine,
  shareBus,
  getTransport,
  MockShareTransport,
  SupabaseShareTransport,
  useShare,
  useGroupMembers,
  useFavoriteFriend,
  useSharedPool,
  useSharedDrinks,
  useSharedRatings,
  useFriendsBac,
  groupSharedPool,
  sharedRatingsMap,
  friendsBacMap,
  sortGroupMembers,
  peekPoolByAuthor,
  loadPoolByAuthor,
  localDrinkToShared,
  tsFromDateTime,
  shareErrorMessage,
  normalizeInviteCode,
  formatInviteCode,
  INVITE_ALPHABET
});