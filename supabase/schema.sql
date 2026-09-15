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
  -- default 'todo' : correspond à l'état réel de la base en production
  -- (vérifié directement sur le projet Supabase live).
  status text not null default 'todo' check (status in ('todo', 'testing', 'needs_work', 'validated')),
  notes text not null default '',
  is_main boolean not null default false,
  -- Vote Discord de validation (✅/❌ sur un message) : 'open' tant que
  -- non résolu par un admin, NULL sinon (résolu ou jamais lancé). Voir
  -- migration_010_discord_votes.sql.
  vote_status text check (vote_status is null or vote_status = 'open'),
  vote_message_id text,
  vote_channel_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists compositions_map_uuid_idx on public.compositions (map_uuid);


-- ---------- Matches (Centre de match / Stats) ----------
-- Utilisée par la fonctionnalité "Match Center" / "Stats" déployée sur le
-- site (gh-pages), historiquement absente du code source versionné.
--
-- Un match est une série (format Bo1/Bo3/Bo5) : la ou les maps jouées,
-- avec leur propre composition et leur propre score, vivent dans
-- match_maps ci-dessous — pas ici. Le score affiché pour le match
-- (ex. "2 – 1") est calculé côté client à partir du nombre de manches
-- gagnées par chaque équipe (voir computeMatchResult dans
-- src/utils/matches.js), pas stocké.

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  opponent_name text not null,
  format text not null default 'bo1' check (format in ('bo1', 'bo3', 'bo5')),
  match_date date,
  notes text not null default '',
  position integer not null default 0,
  opponent_logo_url text,
  -- Validation de présence (✅/❌ sur le message Discord envoyé à la
  -- programmation) : comptage global, resynchronisé à la demande.
  -- Voir migration_010_discord_votes.sql.
  presence_message_id text,
  presence_channel_id text,
  presence_yes integer,
  presence_no integer,
  presence_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Une manche par map jouée dans le match. NULL sur les deux scores =
-- manche "programmée" (map choisie, pas encore jouée) — voir
-- isMatchPlayed() dans src/utils/matches.js.
create table if not exists public.match_maps (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  position integer not null default 0,
  map_uuid text references public.maps(uuid),
  composition_id uuid references public.compositions(id) on delete set null,
  our_score integer,
  opponent_score integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (match_id, position)
);

create index if not exists match_maps_match_id_idx on public.match_maps (match_id);
create index if not exists match_maps_map_uuid_idx on public.match_maps (map_uuid);
create index if not exists match_maps_composition_id_idx on public.match_maps (composition_id);

-- ---------- Profils utilisateurs (admin ou non) ----------
-- Une ligne est créée automatiquement pour chaque nouveau compte
-- (voir le trigger plus bas). Par défaut is_admin = false : c'est
-- vous, ensuite, qui passerez votre propre compte à true (étape 6
-- du README).

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  is_admin boolean not null default false
);

-- search_path figé (bonne pratique pour toute fonction SECURITY DEFINER)
-- et EXECUTE révoqué pour public/anon/authenticated : cette fonction ne
-- doit être appelée que par le trigger interne ci-dessous, jamais
-- directement via l'API REST (/rest/v1/rpc/handle_new_user).
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, is_admin) values (new.id, false)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function public.handle_new_user() from public;

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
alter table public.matches enable row level security;
alter table public.match_maps enable row level security;
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

drop policy if exists "Lecture publique matches" on public.matches;
create policy "Lecture publique matches" on public.matches for select using (true);

drop policy if exists "Lecture publique match_maps" on public.match_maps;
create policy "Lecture publique match_maps" on public.match_maps for select using (true);

-- Un utilisateur connecté peut lire sa propre ligne de profil (utilisé
-- par l'app pour savoir si la personne connectée est admin).
-- (select auth.uid()) plutôt que auth.uid() : Postgres l'évalue une
-- seule fois par requête au lieu d'une fois par ligne (recommandation
-- Supabase pour les policies RLS à l'échelle).
drop policy if exists "Lecture propre profil" on public.profiles;
create policy "Lecture propre profil" on public.profiles for select using ((select auth.uid()) = id);

-- Écriture réservée aux comptes administrateurs.
-- Une policy par action (insert/update/delete) plutôt qu'une seule
-- "for all" : une policy "for all" s'applique aussi au SELECT et ferait
-- doublon avec la policy de lecture publique dédiée ci-dessus.
drop policy if exists "Ecriture admin maps" on public.maps;
create policy "Ecriture admin maps" on public.maps for insert
  with check (exists (select 1 from public.profiles where id = (select auth.uid()) and is_admin = true));
create policy "Modification admin maps" on public.maps for update
  using (exists (select 1 from public.profiles where id = (select auth.uid()) and is_admin = true))
  with check (exists (select 1 from public.profiles where id = (select auth.uid()) and is_admin = true));
create policy "Suppression admin maps" on public.maps for delete
  using (exists (select 1 from public.profiles where id = (select auth.uid()) and is_admin = true));

drop policy if exists "Ecriture admin agents" on public.agents;
create policy "Ecriture admin agents" on public.agents for insert
  with check (exists (select 1 from public.profiles where id = (select auth.uid()) and is_admin = true));
create policy "Modification admin agents" on public.agents for update
  using (exists (select 1 from public.profiles where id = (select auth.uid()) and is_admin = true))
  with check (exists (select 1 from public.profiles where id = (select auth.uid()) and is_admin = true));
create policy "Suppression admin agents" on public.agents for delete
  using (exists (select 1 from public.profiles where id = (select auth.uid()) and is_admin = true));

drop policy if exists "Ecriture admin players" on public.players;
create policy "Ecriture admin players" on public.players for insert
  with check (exists (select 1 from public.profiles where id = (select auth.uid()) and is_admin = true));
create policy "Modification admin players" on public.players for update
  using (exists (select 1 from public.profiles where id = (select auth.uid()) and is_admin = true))
  with check (exists (select 1 from public.profiles where id = (select auth.uid()) and is_admin = true));
create policy "Suppression admin players" on public.players for delete
  using (exists (select 1 from public.profiles where id = (select auth.uid()) and is_admin = true));

drop policy if exists "Ecriture admin compositions" on public.compositions;
create policy "Ecriture admin compositions" on public.compositions for insert
  with check (exists (select 1 from public.profiles where id = (select auth.uid()) and is_admin = true));
create policy "Modification admin compositions" on public.compositions for update
  using (exists (select 1 from public.profiles where id = (select auth.uid()) and is_admin = true))
  with check (exists (select 1 from public.profiles where id = (select auth.uid()) and is_admin = true));
create policy "Suppression admin compositions" on public.compositions for delete
  using (exists (select 1 from public.profiles where id = (select auth.uid()) and is_admin = true));

drop policy if exists "Ecriture admin matches" on public.matches;
create policy "Ecriture admin matches" on public.matches for insert
  with check (exists (select 1 from public.profiles where id = (select auth.uid()) and is_admin = true));
create policy "Modification admin matches" on public.matches for update
  using (exists (select 1 from public.profiles where id = (select auth.uid()) and is_admin = true))
  with check (exists (select 1 from public.profiles where id = (select auth.uid()) and is_admin = true));
create policy "Suppression admin matches" on public.matches for delete
  using (exists (select 1 from public.profiles where id = (select auth.uid()) and is_admin = true));

drop policy if exists "Ecriture admin match_maps" on public.match_maps;
create policy "Ecriture admin match_maps" on public.match_maps for insert
  with check (exists (select 1 from public.profiles where id = (select auth.uid()) and is_admin = true));
create policy "Modification admin match_maps" on public.match_maps for update
  using (exists (select 1 from public.profiles where id = (select auth.uid()) and is_admin = true))
  with check (exists (select 1 from public.profiles where id = (select auth.uid()) and is_admin = true));
create policy "Suppression admin match_maps" on public.match_maps for delete
  using (exists (select 1 from public.profiles where id = (select auth.uid()) and is_admin = true));

-- ---------- Réglages d'équipe (webhook Discord) ----------
-- Table à une seule ligne (singleton, via la contrainte sur `id`).
-- Lecture ET écriture réservées aux admins : contrairement aux autres
-- tables, l'URL d'un webhook doit rester secrète (quiconque la lit
-- peut poster dans votre salon Discord depuis l'extérieur de l'app).

create table if not exists public.team_settings (
  id boolean primary key default true,
  discord_webhook_url text,
  constraint team_settings_singleton check (id)
);

insert into public.team_settings (id) values (true) on conflict (id) do nothing;

alter table public.team_settings enable row level security;

drop policy if exists "Lecture admin team_settings" on public.team_settings;
create policy "Lecture admin team_settings" on public.team_settings for select
  using (exists (select 1 from public.profiles where id = (select auth.uid()) and is_admin = true));

drop policy if exists "Modification admin team_settings" on public.team_settings;
create policy "Modification admin team_settings" on public.team_settings for update
  using (exists (select 1 from public.profiles where id = (select auth.uid()) and is_admin = true))
  with check (exists (select 1 from public.profiles where id = (select auth.uid()) and is_admin = true));

-- ============================================================
-- Temps réel (synchronisation entre tous les membres connectés)
-- ============================================================

alter publication supabase_realtime add table public.compositions;
alter publication supabase_realtime add table public.players;
alter publication supabase_realtime add table public.matches;
alter publication supabase_realtime add table public.match_maps;

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
