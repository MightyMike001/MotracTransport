-- Herstel wijzigingen uit de aangescherpte policies zodat de API weer toegankelijk is.
drop function if exists public.authenticate_app_user(text, text[]);

-- Verwijder policies die de functie current_app_role() gebruiken zodat de functie
-- probleemloos kan worden vervangen. Anders blokkeert PostgreSQL het verwijderen
-- van de functie omdat er afhankelijkheden zijn.
drop policy if exists transport_orders_select_by_role on public.transport_orders;
drop policy if exists transport_orders_modify_by_planner on public.transport_orders;
drop policy if exists transport_orders_update_by_planner on public.transport_orders;
drop policy if exists transport_orders_delete_by_planner on public.transport_orders;
drop policy if exists transport_lines_select_by_role on public.transport_lines;
drop policy if exists transport_lines_insert_by_planner on public.transport_lines;
drop policy if exists transport_lines_update_by_planner on public.transport_lines;
drop policy if exists transport_lines_delete_by_planner on public.transport_lines;
drop policy if exists carriers_select_by_role on public.carriers;
drop policy if exists carriers_insert_by_planner on public.carriers;
drop policy if exists carriers_update_by_planner on public.carriers;
drop policy if exists carriers_delete_by_admin on public.carriers;

drop function if exists public.current_app_role();
drop policy if exists app_users_select_by_role on public.app_users;
drop policy if exists app_users_insert_by_role on public.app_users;
drop policy if exists app_users_insert_signup on public.app_users;
drop policy if exists app_users_update_by_role on public.app_users;
drop policy if exists app_users_delete_by_admin on public.app_users;
drop policy if exists app_user_tokens_select_by_role on public.app_user_tokens;
drop policy if exists app_user_tokens_manage_by_role on public.app_user_tokens;

alter table if exists public.app_user_tokens disable row level security;

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
