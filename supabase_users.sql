-- Maak benodigde extensies voor UUID en case-insensitieve e-mailvergelijking
create extension if not exists pgcrypto;
create extension if not exists citext;

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

-- Schakel Row Level Security in en maak eenvoudige policies voor de demo.
-- Let op: in productie moeten policies worden aangescherpt zodat alleen geautoriseerde
-- service clients deze tabel kunnen wijzigen.
alter table public.app_users enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'app_users'
      and policyname = 'allow anon read users'
  ) then
    create policy "allow anon read users"
      on public.app_users
      for select
      using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'app_users'
      and policyname = 'allow anon modify users'
  ) then
    create policy "allow anon modify users"
      on public.app_users
      for all
      using (true)
      with check (true);
  end if;
end $$;
