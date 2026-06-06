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

-- ── RPC : créer / rejoindre / quitter un groupe ────────────────────────────
-- Génère un code lisible (sans I/O/0/1), format XXXX-XXXX.
create or replace function public.gen_invite_code()
returns text language sql volatile as $$
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
                           (floor(random()*32)+1)::int, 1), '')
         from generate_series(1,4)
  || '-' ||
         string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
                           (floor(random()*32)+1)::int, 1), '')
         from generate_series(1,4);
$$;

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
  insert into public.invites (token, group_id, created_by, expires_at)
    values (code, gid, auth.uid(), now() + interval '30 days');
  return json_build_object('group_id', gid, 'invite_code', code);
end;
$$;

create or replace function public.join_group(invite_token text)
returns json
language plpgsql security definer
set search_path = public
as $$
declare inv public.invites;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into inv from public.invites where token = upper(invite_token);
  if inv.token is null then raise exception 'invalid invite'; end if;
  if inv.expires_at is not null and inv.expires_at < now() then raise exception 'expired invite'; end if;
  if inv.uses >= inv.max_uses then raise exception 'invite exhausted'; end if;
  insert into public.group_members (group_id, user_id)
    values (inv.group_id, auth.uid())
    on conflict (group_id, user_id) do nothing;
  update public.invites set uses = uses + 1 where token = inv.token;
  return json_build_object('group_id', inv.group_id);
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

grant execute on function public.create_group()      to anon, authenticated;
grant execute on function public.join_group(text)    to anon, authenticated;
grant execute on function public.leave_group(uuid)   to anon, authenticated;
