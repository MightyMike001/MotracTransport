-- Maak benodigde extensies voor UUID en case-insensitieve e-mailvergelijking
create extension if not exists pgcrypto;
create extension if not exists citext;

-- Hulpfunctie om de applicatierol uit het JWT te lezen.
create or replace function public.current_app_role()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(auth.jwt() ->> 'app_role', ''),
    nullif(auth.jwt() -> 'app_metadata' ->> 'role', ''),
    nullif(auth.jwt() -> 'user_metadata' ->> 'role', ''),
    nullif(auth.jwt() ->> 'role', ''),
    'anon'
  );
$$;

-- Tabel met applicatiegebruikers voor de transportplanner
create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email citext not null unique,
  role text not null default 'in aanvraag' check (role in ('admin', 'planner', 'werknemer', 'in aanvraag')),
  password_hash text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Zorg ervoor dat bestaande databases de uitgebreidere rollenlijst accepteren.
alter table public.app_users
  drop constraint if exists app_users_role_check;

alter table public.app_users
  add constraint app_users_role_check
  check (role in ('admin', 'planner', 'werknemer', 'in aanvraag'));

comment on table public.app_users is 'Authenticatiegebruikers voor de transportplanner webapplicatie.';

-- Tokens die applicatierollen bevatten voor gebruik binnen de webapplicatie.
create table if not exists public.app_user_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  token text not null,
  app_role text,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

create index if not exists app_user_tokens_user_id_idx
  on public.app_user_tokens (user_id);

create unique index if not exists app_user_tokens_token_key
  on public.app_user_tokens (token);

comment on table public.app_user_tokens is 'Bevat vooraf uitgegeven applicatietokens voor gebruikersrollen.';

alter table public.app_users enable row level security;
alter table public.app_user_tokens enable row level security;

drop policy if exists "allow anon read users" on public.app_users;
drop policy if exists "allow anon modify users" on public.app_users;
drop policy if exists app_users_select_by_role on public.app_users;
drop policy if exists app_users_insert_by_role on public.app_users;
drop policy if exists app_users_insert_signup on public.app_users;
drop policy if exists app_users_update_by_role on public.app_users;
drop policy if exists app_users_delete_by_admin on public.app_users;

drop policy if exists app_user_tokens_select_by_role on public.app_user_tokens;
drop policy if exists app_user_tokens_manage_by_role on public.app_user_tokens;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'app_users'
      and policyname = 'app_users_select_by_role'
  ) then
    create policy app_users_select_by_role
      on public.app_users
      for select
      using (public.current_app_role() in ('admin', 'planner'));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'app_users'
      and policyname = 'app_users_insert_by_role'
  ) then
    create policy app_users_insert_by_role
      on public.app_users
      for insert
      with check (public.current_app_role() in ('admin', 'planner'));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'app_users'
      and policyname = 'app_users_insert_signup'
  ) then
    create policy app_users_insert_signup
      on public.app_users
      for insert
      with check (
        public.current_app_role() = 'anon'
        and role = 'in aanvraag'
        and is_active = true
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'app_users'
      and policyname = 'app_users_update_by_role'
  ) then
    create policy app_users_update_by_role
      on public.app_users
      for update
      using (public.current_app_role() in ('admin', 'planner'))
      with check (public.current_app_role() in ('admin', 'planner'));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'app_users'
      and policyname = 'app_users_delete_by_admin'
  ) then
    create policy app_users_delete_by_admin
      on public.app_users
      for delete
      using (public.current_app_role() = 'admin');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'app_user_tokens'
      and policyname = 'app_user_tokens_select_by_role'
  ) then
    create policy app_user_tokens_select_by_role
      on public.app_user_tokens
      for select
      using (public.current_app_role() in ('admin', 'planner'));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'app_user_tokens'
      and policyname = 'app_user_tokens_manage_by_role'
  ) then
    create policy app_user_tokens_manage_by_role
      on public.app_user_tokens
      for all
      using (public.current_app_role() in ('admin', 'planner'))
      with check (public.current_app_role() in ('admin', 'planner'));
  end if;
end $$;

-- Authenticatiefunctie om inloggen via RPC mogelijk te maken zonder brede leesrechten.
create or replace function public.authenticate_app_user(
  _email text,
  _password_hashes text[]
)
returns table (
  id uuid,
  full_name text,
  email text,
  role text,
  is_active boolean,
  token text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  auth_user public.app_users%rowtype;
  auth_token text;
begin
  if coalesce(trim(_email), '') = '' then
    return;
  end if;

  if _password_hashes is null or array_length(_password_hashes, 1) is null then
    return;
  end if;

  select *
    into auth_user
  from public.app_users
  where email = _email
    and password_hash = any(_password_hashes)
  limit 1;

  if not found then
    return;
  end if;

  select token
    into auth_token
  from public.app_user_tokens
  where user_id = auth_user.id
    and (expires_at is null or expires_at > now())
  order by coalesce(expires_at, now()) desc
  limit 1;

  id := auth_user.id;
  full_name := auth_user.full_name;
  email := auth_user.email;
  role := auth_user.role;
  is_active := auth_user.is_active;
  token := auth_token;

  return next;
end;
$$;

grant execute on function public.authenticate_app_user(text, text[]) to anon, authenticated;

comment on function public.authenticate_app_user(text, text[]) is 'Valideert gebruikersreferenties en geeft de bijbehorende gebruiker met token terug.';
