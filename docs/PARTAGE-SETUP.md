# Partage entre amis — Configuration

La fonctionnalité « Amis » fonctionne **sans rien configurer** en mode
démonstration (`mock`) : des amis fictifs sont simulés en local. Pour le
partage **réel** entre appareils, branche un projet Supabase (gratuit, UE).

## 1. Créer le projet Supabase
1. Va sur https://supabase.com → **New project**.
2. Choisis une **région UE** (ex. *Frankfurt / eu-central-1*) — important pour
   le RGPD (données de santé).
3. Note le mot de passe de la base (non utilisé côté app, mais requis à la
   création).

## 2. Activer l'authentification anonyme
**Authentication → Providers → Anonymous** : activer.
(Chaque utilisateur reçoit une identité anonyme, sans email.)

## 3. Créer les tables et les règles de sécurité
**SQL Editor → New query** : colle le contenu de
[`supabase/schema.sql`](../supabase/schema.sql) puis **Run**.
Cela crée les tables (`groups`, `group_members`, `invites`, `shared_drinks`,
`shared_profiles`), les règles **RLS**, et les fonctions `create_group` /
`join_group` / `leave_group`.

## 4. Récupérer les clés
**Project Settings → API** :
- **Project URL** (ex. `https://xxxx.supabase.co`)
- **anon public** key

> La clé `anon` est **publique** par conception (protégée par les règles RLS) :
> OK de la committer. Ne mets **jamais** la clé `service_role` côté client.

## 5. Renseigner l'app
Édite [`js/share-config.js`](../js/share-config.js) :
```js
window.SHARE_CONFIG = {
  TRANSPORT: 'supabase',
  SUPABASE_URL: 'https://xxxx.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOi...',
  PULL_INTERVAL_MS: 10 * 60 * 1000,
};
```
Le SDK Supabase est chargé automatiquement à la demande (rien à ajouter).

## 6. Utiliser
1. Recharge l'app (un nouveau service worker s'active — la version passe à
   `v3.22.0`).
2. **Paramètres** (menu en haut à gauche) → section **Partage entre amis** :
   active le partage, choisis un **pseudo**, puis **Créer un groupe**.
3. Partage le **code d'invitation** ; tes amis le saisissent dans l'onglet
   **Amis** (ou Paramètres) pour rejoindre.
4. (Optionnel) Active **Partager mon alcoolémie** pour que tes amis voient ton
   BAC en direct (partage poids + sexe).

## Sécurité & vie privée
- Jamais de **GPS** ni de code-barres partagés.
- Le **poids/sexe** ne partent que si tu actives explicitement le BAC.
- **Quitter le groupe** efface tes données partagées côté serveur et purge le
  cache local des amis.
- Les données des amis vivent dans une table locale **séparée et en lecture
  seule** ; elles ne touchent jamais tes propres données.
- Pense à publier une **politique de confidentialité** (hébergement UE,
  consentement, droit à l'effacement) avant une diffusion publique.
