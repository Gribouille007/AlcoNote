/*
 * AlcoNote — Configuration du partage entre amis.
 *
 * Ce fichier est édité par toi (pas auto-généré). Pour activer le partage réel :
 *   1. Crée un projet Supabase (région UE, ex. Frankfurt eu-central-1).
 *   2. Auth → Providers : active "Anonymous sign-ins".
 *   3. SQL Editor : exécute le script supabase/schema.sql.
 *   4. Project Settings → API : copie l'URL du projet et la clé "anon public".
 *   5. Remplis SUPABASE_URL / SUPABASE_ANON_KEY ci-dessous et passe
 *      TRANSPORT à 'supabase'.
 *
 * La clé "anon" est PUBLIQUE par conception (protégée par les règles RLS) — OK
 * à committer. Ne mets JAMAIS la clé "service_role" ici.
 *
 * Tant que TRANSPORT === 'mock', l'app fonctionne sans réseau : des amis
 * fictifs sont simulés en local pour développer/tester l'onglet Amis.
 */
window.SHARE_CONFIG = {
  // 'mock' = amis simulés en local · 'supabase' = backend réel
  TRANSPORT: 'supabase',

  SUPABASE_URL: 'https://fxhezzceinifisxfpchv.supabase.co',
  // Clé "publishable" (publique, protégée par RLS). JAMAIS la clé "secret".
  SUPABASE_ANON_KEY: 'sb_publishable_s-cuLxdmNBmsODhMDunBJw_QogMAloG',

  // Intervalle d'auto-refresh des données des amis (ms), au premier plan only.
  PULL_INTERVAL_MS: 10 * 60 * 1000,
};
