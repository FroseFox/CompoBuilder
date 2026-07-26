-- ============================================================
-- Comp Builder — schéma Supabase complet
--
-- À exécuter en une seule fois dans : Supabase Dashboard >
-- votre projet > SQL Editor > New query > coller tout ce fichier > Run.
--
-- Ce script est sans risque à ré-exécuter (idempotent) grâce aux
-- "if not exists" / "or replace", sauf les lignes clairement indiquées.
-- ============================================================

-- Nécessaire pour gen_random_uuid()
create extension if not exists "pgcrypto";

-- ---------- Tables de référence (jeu) ----------
-- Remplies automatiquement par l'application quand un administrateur
-- se connecte (synchronisation depuis valorant-api.com). Vous n'avez
-- rien à taper dedans manuellement.

create table if not exists public.maps (
  uuid text primary key,
  name text not null
);

create table if not exists public.agents (
  uuid text primary key,
  name text not null,
  role text not null
);

-- ---------- Joueurs ----------

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  pseudo text not null,
  primary_role text,
  secondary_role text,
  color text not null default '#ff4655',
  created_at timestamptz not null default now()
);

-- ---------- Compositions ----------

create table if not exists public.compositions (
  id uuid primary key default gen_random_uuid(),
  map_uuid text not null references public.maps(uuid) on delete cascade,
  name text not null default 'Composition principale',
  slots jsonb not null default '[
    {"agentUuid": null, "playerId": null},
    {"agentUuid": null, "playerId": null},
    {"agentUuid": null, "playerId": null},
    {"agentUuid": null, "playerId": null},
    {"agentUuid": null, "playerId": null}
  ]'::jsonb,
  status text not null default 'testing' check (status in ('validated', 'testing', 'needs_work')),
  notes text not null default '',
  is_main boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists compositions_map_uuid_idx on public.compositions (map_uuid);

-- ---------- Profils utilisateurs (admin ou non) ----------
-- Une ligne est créée automatiquement pour chaque nouveau compte
-- (voir le trigger plus bas). Par défaut is_admin = false : c'est
-- vous, ensuite, qui passerez votre propre compte à true (étape 6
-- du README).

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  is_admin boolean not null default false
);

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, is_admin) values (new.id, false)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- Sécurité (Row Level Security)
--
-- Principe : tout le monde peut LIRE (les membres de l'équipe
-- consultent sans compte), seul un compte marqué is_admin = true
-- peut ÉCRIRE (créer/modifier/supprimer).
-- ============================================================

alter table public.maps enable row level security;
alter table public.agents enable row level security;
alter table public.players enable row level security;
alter table public.compositions enable row level security;
alter table public.profiles enable row level security;

-- Lecture publique (y compris sans être connecté)
drop policy if exists "Lecture publique maps" on public.maps;
create policy "Lecture publique maps" on public.maps for select using (true);

drop policy if exists "Lecture publique agents" on public.agents;
create policy "Lecture publique agents" on public.agents for select using (true);

drop policy if exists "Lecture publique players" on public.players;
create policy "Lecture publique players" on public.players for select using (true);

drop policy if exists "Lecture publique compositions" on public.compositions;
create policy "Lecture publique compositions" on public.compositions for select using (true);

-- Un utilisateur connecté peut lire sa propre ligne de profil (utilisé
-- par l'app pour savoir si la personne connectée est admin).
drop policy if exists "Lecture propre profil" on public.profiles;
create policy "Lecture propre profil" on public.profiles for select using (auth.uid() = id);

-- Écriture réservée aux comptes administrateurs
drop policy if exists "Ecriture admin maps" on public.maps;
create policy "Ecriture admin maps" on public.maps for all
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true))
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

drop policy if exists "Ecriture admin agents" on public.agents;
create policy "Ecriture admin agents" on public.agents for all
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true))
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

drop policy if exists "Ecriture admin players" on public.players;
create policy "Ecriture admin players" on public.players for all
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true))
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

drop policy if exists "Ecriture admin compositions" on public.compositions;
create policy "Ecriture admin compositions" on public.compositions for all
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true))
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

-- ============================================================
-- Temps réel (synchronisation entre tous les membres connectés)
-- ============================================================

alter publication supabase_realtime add table public.compositions;
alter publication supabase_realtime add table public.players;

-- ============================================================
-- Dernière étape manuelle (à faire une seule fois) :
--
-- 1. Créez votre compte admin dans Authentication > Users > Add user
--    (email + mot de passe), dans le dashboard Supabase.
-- 2. Copiez son UID (colonne "UID" dans la liste des utilisateurs).
-- 3. Exécutez la ligne ci-dessous en remplaçant VOTRE_UID :
--
-- update public.profiles set is_admin = true where id = 'VOTRE_UID';
-- ============================================================
