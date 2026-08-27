-- AlcoNote — Schéma Supabase pour le partage entre amis.
-- À exécuter dans Supabase › SQL Editor (région UE).
-- Idempotent : ré-exécutable sans casse.
--
-- Sécurité : Row-Level Security (RLS) sur toutes les tables. L'adhésion à un
-- groupe se fait UNIQUEMENT via la fonction join_group() (SECURITY DEFINER),
-- jamais par écriture directe dans group_members — ce qui ferme la faille
-- « n'importe qui se rajoute à n'importe quel groupe ».

-- ── Tables ────────────────────────────────────────────────────────────────
create table if not exists public.groups (
  id          uuid primary key default gen_random_uuid(),
  name        text,
  created_by  uuid,
  created_at  timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id     uuid not null references public.groups(id) on delete cascade,
  user_id      uuid not null,
  display_name text,
  joined_at    timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table if not exists public.invites (
  token       text primary key,
  group_id    uuid not null references public.groups(id) on delete cascade,
  created_by  uuid,
  expires_at  timestamptz,
  max_uses    int  not null default 50,
  uses        int  not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.shared_drinks (
  uid             text primary key,
  group_id        uuid not null references public.groups(id) on delete cascade,
  author_id       uuid not null,
  ts_utc          bigint,
  "date"          text,
  "time"          text,
  name            text,
  quantity        numeric,
  unit            text,
  quantity_in_cl  numeric,
  alcohol_content numeric,
  category        text,
  rating          int,
  updated_at      bigint not null,
  deleted         boolean not null default false
);
create index if not exists shared_drinks_group_updated_idx
  on public.shared_drinks (group_id, updated_at);

create table if not exists public.shared_profiles (
  user_id      uuid not null,
  group_id     uuid not null references public.groups(id) on delete cascade,
  display_name text,
  share_enabled boolean not null default true,
  share_bac    boolean not null default false,
  bac_weight   numeric,
  bac_gender   text,
  updated_at   bigint not null,
  primary key (user_id, group_id)
);

-- ── Privilèges de table (RLS filtre ENSUITE les lignes) ────────────────────
-- Les rôles anon/authenticated reçoivent normalement ces droits par défaut sur
-- le schéma public, mais on les pose EXPLICITEMENT : sans GRANT, PostgREST
-- renvoie « permission denied for table … » même quand les policies RLS sont
-- correctes (cause classique de « aucune donnée partagée »). RLS reste la vraie
-- barrière de sécurité ligne-à-ligne (les écritures interdites restent bloquées
-- faute de policy INSERT/UPDATE correspondante).
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on
  public.groups, public.group_members, public.invites,
  public.shared_drinks, public.shared_profiles
  to anon, authenticated;

-- ── Helper : appartenance au groupe ────────────────────────────────────────
create or replace function public.is_member(gid uuid)
returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1 from public.group_members
    where group_id = gid and user_id = auth.uid()
  );
$$;

-- ── RLS ────────────────────────────────────────────────────────────────────
alter table public.groups          enable row level security;
alter table public.group_members   enable row level security;
alter table public.invites         enable row level security;
alter table public.shared_drinks   enable row level security;
alter table public.shared_profiles enable row level security;

-- groups : lecture réservée aux membres ; pas d'écriture directe (RPC only).
drop policy if exists groups_select on public.groups;
create policy groups_select on public.groups
  for select using (public.is_member(id));

-- group_members : un membre voit ses co-membres ; auto-retrait autorisé.
drop policy if exists members_select on public.group_members;
create policy members_select on public.group_members
  for select using (public.is_member(group_id));
drop policy if exists members_delete_self on public.group_members;
create policy members_delete_self on public.group_members
  for delete using (user_id = auth.uid());

-- invites : visibles par les membres du groupe (création via RPC).
drop policy if exists invites_select on public.invites;
create policy invites_select on public.invites
  for select using (public.is_member(group_id));

-- shared_drinks : lecture = membres ; écriture = auteur membre uniquement.
drop policy if exists drinks_select on public.shared_drinks;
create policy drinks_select on public.shared_drinks
  for select using (public.is_member(group_id));
drop policy if exists drinks_insert on public.shared_drinks;
create policy drinks_insert on public.shared_drinks
  for insert with check (author_id = auth.uid() and public.is_member(group_id));
drop policy if exists drinks_update on public.shared_drinks;
create policy drinks_update on public.shared_drinks
  for update using (author_id = auth.uid()) with check (author_id = auth.uid());
drop policy if exists drinks_delete on public.shared_drinks;
create policy drinks_delete on public.shared_drinks
  for delete using (author_id = auth.uid());

-- shared_profiles : lecture = membres ; écriture = soi-même.
drop policy if exists profiles_select on public.shared_profiles;
create policy profiles_select on public.shared_profiles
  for select using (public.is_member(group_id));
drop policy if exists profiles_upsert on public.shared_profiles;
create policy profiles_upsert on public.shared_profiles
  for insert with check (user_id = auth.uid() and public.is_member(group_id));
drop policy if exists profiles_update on public.shared_profiles;
create policy profiles_update on public.shared_profiles
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── Codes d'invitation ─────────────────────────────────────────────────────
-- Forme canonique d'un code : MAJUSCULES sans séparateur. Un code se transmet
-- à l'oral, par SMS, en copier-coller : « ab12-cd34 », « AB12 CD34 » et
-- « AB12CD34 » désignent LE MÊME code. Toute comparaison passe par ici (côté
-- client comme côté serveur) — sinon un tiret oublié = « code invalide ».
create or replace function public.normalize_invite_code(raw text)
returns text language sql immutable as $$
  select upper(regexp_replace(coalesce(raw, ''), '[^A-Za-z0-9]', '', 'g'));
$$;

-- Recherche indexée d'un invite par code normalisé (non unique : deux codes
-- distincts ne peuvent pas se normaliser pareil en pratique, et un index
-- unique ferait échouer la migration sur une base historique douteuse).
create index if not exists invites_token_norm_idx
  on public.invites (public.normalize_invite_code(token));

-- Génère un code lisible (sans I/O/0/1), format XXXX-XXXX.
create or replace function public.gen_invite_code()
returns text language sql volatile as $$
  with picked as (
    select string_agg(
             substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
                    (floor(random() * 32) + 1)::int, 1), '') as t
    from generate_series(1, 8)
  )
  select substr(t, 1, 4) || '-' || substr(t, 5, 4) from picked;
$$;

-- ── Migration : les invitations ne périment plus ───────────────────────────
-- Un code d'invitation est le SEUL moyen d'entrer dans un groupe et l'app
-- n'offrait aucun moyen d'en régénérer un : une expiration (30 j) ou un
-- compteur d'usages épuisé rendait le groupe DÉFINITIVEMENT inaccessible
-- (« rejoindre ne marche plus du tout »). On lève les deux limites, ici pour
-- les groupes existants et plus bas dans create_group pour les nouveaux.
alter table public.invites alter column max_uses set default 1000000000;
update public.invites
   set expires_at = null,
       max_uses   = greatest(max_uses, 1000000000)
 where expires_at is not null or max_uses < 1000000000;

-- ── RPC : créer / rejoindre / quitter un groupe ────────────────────────────

create or replace function public.create_group()
returns json
language plpgsql security definer
set search_path = public
as $$
declare gid uuid; code text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  insert into public.groups (created_by) values (auth.uid()) returning id into gid;
  insert into public.group_members (group_id, user_id) values (gid, auth.uid());
  code := public.gen_invite_code();
  -- expires_at NULL = invitation permanente (cf. migration ci-dessus).
  insert into public.invites (token, group_id, created_by, expires_at)
    values (code, gid, auth.uid(), null);
  return json_build_object('group_id', gid, 'invite_code', code);
end;
$$;

-- Rejoindre un groupe. Robuste par construction :
--   · comparaison sur le code NORMALISÉ (casse, tirets, espaces indifférents) ;
--   · un membre déjà présent re-rejoint sans erreur (idempotent) — c'est le
--     chemin de la réinstallation / du changement d'appareil ;
--   · le compteur d'usages n'avance que sur une VRAIE adhésion, jamais sur une
--     re-adhésion, et l'invitation ne périme plus (cf. migration).
create or replace function public.join_group(invite_token text)
returns json
language plpgsql security definer
set search_path = public
as $$
declare
  inv     public.invites;
  v_norm  text;
  v_rows  int := 0;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  v_norm := public.normalize_invite_code(invite_token);
  if v_norm = '' then raise exception 'invalid invite'; end if;
  select * into inv from public.invites
    where public.normalize_invite_code(token) = v_norm
    limit 1;
  if inv.token is null then raise exception 'invalid invite'; end if;
  if inv.expires_at is not null and inv.expires_at < now() then raise exception 'expired invite'; end if;
  if inv.uses >= inv.max_uses then raise exception 'invite exhausted'; end if;
  insert into public.group_members (group_id, user_id)
    values (inv.group_id, auth.uid())
    on conflict (group_id, user_id) do nothing;
  -- row_count vaut 1 sur une VRAIE adhésion, 0 sur un re-join (do nothing).
  get diagnostics v_rows = row_count;
  if v_rows > 0 then
    update public.invites set uses = uses + 1 where token = inv.token;
  end if;
  return json_build_object('group_id', inv.group_id, 'invite_code', inv.token);
end;
$$;

-- Code d'invitation COURANT d'un groupe, pour n'importe lequel de ses membres.
-- Indispensable pour que « rejoindre » marche toujours : sans cette RPC, un
-- membre qui a réinstallé l'app (ou qui a rejoint sans jamais créer) n'avait
-- plus aucun code à transmettre, et un groupe dont l'invitation avait péri
-- devenait fermé pour toujours. Réutilise une invitation valide s'il en existe
-- une, en crée une sinon.
create or replace function public.ensure_invite(p_group_id uuid)
returns json
language plpgsql security definer
set search_path = public
as $$
declare code text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not public.is_member(p_group_id) then raise exception 'not a member'; end if;
  select token into code from public.invites
    where group_id = p_group_id
      and (expires_at is null or expires_at > now())
      and uses < max_uses
    order by created_at desc
    limit 1;
  if code is null then
    code := public.gen_invite_code();
    insert into public.invites (token, group_id, created_by, expires_at)
      values (code, p_group_id, auth.uid(), null);
  end if;
  return json_build_object('group_id', p_group_id, 'invite_code', code);
end;
$$;

create or replace function public.leave_group(p_group_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  delete from public.shared_drinks   where group_id = p_group_id and author_id = auth.uid();
  delete from public.shared_profiles where group_id = p_group_id and user_id   = auth.uid();
  delete from public.group_members   where group_id = p_group_id and user_id   = auth.uid();
end;
$$;

-- Retire un membre du groupe (et purge toutes ses données partagées).
-- Droits : le CRÉATEUR du groupe (groups.created_by) peut retirer n'importe
-- qui ; si created_by est NULL (groupe historique au créateur inconnu), tout
-- membre peut retirer. Pas de nouvelle policy nécessaire : les écritures
-- passent par SECURITY DEFINER et la lecture de groups.created_by côté client
-- est déjà couverte par la policy groups_select.
create or replace function public.remove_member(p_group_id uuid, p_user_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare v_creator uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not public.is_member(p_group_id) then raise exception 'not a member'; end if;
  select created_by into v_creator from public.groups where id = p_group_id;
  if v_creator is not null and v_creator <> auth.uid() then
    raise exception 'only the group creator can remove members';
  end if;
  delete from public.shared_drinks   where group_id = p_group_id and author_id = p_user_id;
  delete from public.shared_profiles where group_id = p_group_id and user_id   = p_user_id;
  delete from public.group_members   where group_id = p_group_id and user_id   = p_user_id;
end;
$$;

grant execute on function public.normalize_invite_code(text) to anon, authenticated;
grant execute on function public.create_group()              to anon, authenticated;
grant execute on function public.join_group(text)            to anon, authenticated;
grant execute on function public.ensure_invite(uuid)         to anon, authenticated;
grant execute on function public.leave_group(uuid)           to anon, authenticated;
grant execute on function public.remove_member(uuid, uuid)   to anon, authenticated;
