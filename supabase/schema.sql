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
  -- Compte connecté à cette fiche (connexion Discord — voir la section
  -- Comptes du README), pour que ce joueur (et lui seul, ou un admin)
  -- puisse cocher ses propres disponibilités. NULL pour une fiche créée
  -- manuellement par un admin et jamais reliée à un compte.
  user_id uuid unique references auth.users(id) on delete set null,
  -- Identifiant Discord stable (raw_user_meta_data->>'provider_id' ou
  -- 'sub'), distinct de user_id : user_id change si le compte Supabase
  -- est supprimé puis recréé (la personne se reconnecte), discord_id
  -- non. C'est lui qui sert de clé pour la liste noire — voir
  -- banned_discord_ids et public.ban_and_remove_player() plus bas — et
  -- pour relier une reconnexion à la fiche existante plutôt que d'en
  -- créer une seconde. NULL pour une fiche créée manuellement.
  discord_id text unique,
  created_at timestamptz not null default now()
);

create index if not exists players_user_id_idx on public.players (user_id);
create index if not exists players_discord_id_idx on public.players (discord_id);

-- ---------- Liste noire Discord (retrait d'effectif) ----------
-- Supprimer un compte Supabase ne révoque PAS l'autorisation OAuth
-- Discord sous-jacente : la personne peut se reconnecter instantanément
-- et se voir recréer un compte. Cette table est donc la vraie mémoire de
-- "cette personne ne doit plus réapparaître dans l'effectif" — consultée
-- par handle_new_user() ci-dessous avant de créer une fiche automatique,
-- et alimentée par public.ban_and_remove_player().
create table if not exists public.banned_discord_ids (
  discord_id text primary key,
  banned_by uuid references auth.users(id) on delete set null,
  reason text,
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
  match_time time,
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

-- ---------- Disponibilités des joueurs ----------
-- Calendrier réel (une date précise, pas un jour de semaine récurrent) :
-- chaque ligne = un joueur disponible ce jour-là, sur cette période. Le
-- front-end croise ces dates avec celles de `matches` pour signaler les
-- jours où un match est prévu directement sur la grille. Voir la section
-- Sécurité plus bas : seul le compte associé à ce joueur (ou un admin)
-- peut écrire sur sa propre ligne — voir public.claim_player().

create table if not exists public.player_availability (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  date date not null,
  period text not null check (period in ('morning', 'afternoon', 'evening')),
  created_at timestamptz not null default now(),
  unique (player_id, date, period)
);

create index if not exists player_availability_player_id_idx on public.player_availability (player_id);
create index if not exists player_availability_date_idx on public.player_availability (date);

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
--
-- Pour une connexion Discord (seul provider actif — voir la section
-- Comptes du README), crée aussi automatiquement la fiche joueur : c'est
-- la connexion Discord elle-même qui constitue l'effectif, il n'y a rien
-- à "associer" manuellement. Une personne bannie (banned_discord_ids)
-- garde un profil (sans droit) mais n'obtient jamais de fiche joueur.
create or replace function public.handle_new_user()
returns trigger as $$
declare
  v_discord_id text;
  v_pseudo text;
  v_existing_player_id uuid;
begin
  insert into public.profiles (id, is_admin) values (new.id, false)
  on conflict (id) do nothing;

  v_discord_id := coalesce(new.raw_user_meta_data ->> 'provider_id', new.raw_user_meta_data ->> 'sub');

  if v_discord_id is not null then
    if exists (select 1 from public.banned_discord_ids where discord_id = v_discord_id) then
      return new;
    end if;

    -- Une fiche existe déjà pour ce discord_id (compte Supabase supprimé
    -- sans bannir, la personne se reconnecte) : on la relie au nouveau
    -- compte plutôt que d'en créer une seconde.
    select id into v_existing_player_id from public.players where discord_id = v_discord_id;

    if v_existing_player_id is not null then
      update public.players set user_id = new.id where id = v_existing_player_id;
    else
      v_pseudo := coalesce(
        new.raw_user_meta_data -> 'custom_claims' ->> 'global_name',
        new.raw_user_meta_data ->> 'full_name',
        new.raw_user_meta_data ->> 'name',
        'Joueur'
      );
      insert into public.players (pseudo, discord_id, user_id) values (v_pseudo, v_discord_id, new.id);
    end if;
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function public.handle_new_user() from public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Associe le compte actuellement connecté à une fiche joueur existante
-- ("je suis Machin") sans donner à cette personne le droit de modifier
-- des lignes de `players` en général : SECURITY DEFINER contourne les
-- policies RLS (comme handle_new_user ci-dessus), mais la fonction fait
-- elle-même toute la vérification — n'accepte que les fiches pas encore
-- associées, et ne peut jamais associer quelqu'un d'autre que l'appelant.
-- Appelée depuis le site via supabase.rpc('claim_player', ...).
create or replace function public.claim_player(target_player_id uuid)
returns public.players
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_row public.players;
begin
  if auth.uid() is null then
    raise exception 'Connexion requise.';
  end if;

  update public.players
  set user_id = auth.uid()
  where id = target_player_id and user_id is null
  returning * into updated_row;

  if updated_row.id is null then
    raise exception 'Cette fiche joueur est introuvable ou déjà associée à un compte.';
  end if;

  return updated_row;
end;
$$;

revoke all on function public.claim_player(uuid) from public;
grant execute on function public.claim_player(uuid) to authenticated;

-- Retire un joueur de l'effectif ET empêche son compte Discord d'y
-- réapparaître automatiquement à la prochaine connexion (voir le
-- commentaire sur banned_discord_ids : supprimer seul ne suffit pas).
-- Réservé aux admins — vérifié dans la fonction elle-même puisque
-- SECURITY DEFINER contourne les policies RLS. Appelée depuis le site
-- via supabase.rpc('ban_and_remove_player', ...).
create or replace function public.ban_and_remove_player(target_player_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_discord_id text;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_admin = true) then
    raise exception 'Réservé aux administrateurs.';
  end if;

  select discord_id into v_discord_id from public.players where id = target_player_id;

  if v_discord_id is not null then
    insert into public.banned_discord_ids (discord_id, banned_by)
    values (v_discord_id, auth.uid())
    on conflict (discord_id) do nothing;
  end if;

  delete from public.players where id = target_player_id;
end;
$$;

revoke all on function public.ban_and_remove_player(uuid) from public;
grant execute on function public.ban_and_remove_player(uuid) to authenticated;

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
alter table public.player_availability enable row level security;
alter table public.banned_discord_ids enable row level security;

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

-- ---------- Disponibilités des joueurs ----------
-- Lecture publique comme le reste du site, mais l'écriture n'est ni
-- ouverte à tout le monde ni réservée aux admins : chaque compte ne peut
-- écrire QUE sur la ligne du joueur auquel il est associé (players.user_id
-- = son propre compte, via public.claim_player()), plus les admins qui
-- gardent la main pour dépanner un joueur sans compte.

drop policy if exists "Lecture publique player_availability" on public.player_availability;
create policy "Lecture publique player_availability" on public.player_availability for select using (true);

-- Écriture ouverte à tous, sans compte : ancienne policy (migration_012),
-- remplacée ci-dessous par migration_013. Supprimée ici si encore présente.
drop policy if exists "Ecriture libre player_availability" on public.player_availability;
drop policy if exists "Suppression libre player_availability" on public.player_availability;

drop policy if exists "Ecriture propre ou admin player_availability" on public.player_availability;
create policy "Ecriture propre ou admin player_availability" on public.player_availability for insert
  with check (
    exists (select 1 from public.players where players.id = player_availability.player_id and players.user_id = (select auth.uid()))
    or exists (select 1 from public.profiles where id = (select auth.uid()) and is_admin = true)
  );

drop policy if exists "Suppression propre ou admin player_availability" on public.player_availability;
create policy "Suppression propre ou admin player_availability" on public.player_availability for delete
  using (
    exists (select 1 from public.players where players.id = player_availability.player_id and players.user_id = (select auth.uid()))
    or exists (select 1 from public.profiles where id = (select auth.uid()) and is_admin = true)
  );

-- ---------- Liste noire Discord ----------
-- Lecture ET écriture réservées aux admins, comme team_settings plus
-- bas : personne d'autre n'a besoin de savoir qui est banni, et seul un
-- admin doit pouvoir modifier cette liste (l'écriture normale passe par
-- public.ban_and_remove_player(), mais une policy insert est gardée pour
-- un bannissement direct, sans fiche joueur à retirer en même temps).

drop policy if exists "Lecture admin banned_discord_ids" on public.banned_discord_ids;
create policy "Lecture admin banned_discord_ids" on public.banned_discord_ids for select
  using (exists (select 1 from public.profiles where id = (select auth.uid()) and is_admin = true));

drop policy if exists "Ecriture admin banned_discord_ids" on public.banned_discord_ids;
create policy "Ecriture admin banned_discord_ids" on public.banned_discord_ids for insert
  with check (exists (select 1 from public.profiles where id = (select auth.uid()) and is_admin = true));

drop policy if exists "Suppression admin banned_discord_ids" on public.banned_discord_ids;
create policy "Suppression admin banned_discord_ids" on public.banned_discord_ids for delete
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
alter publication supabase_realtime add table public.player_availability;

-- ============================================================
-- Dernières étapes manuelles (à faire une seule fois) :
--
-- 1. Créez une application OAuth2 sur le Discord Developer Portal
--    (discord.com/developers/applications), avec comme redirect URI
--    l'URL de callback Supabase (Authentication > Providers > Discord
--    dans le dashboard Supabase vous la donne). Collez le Client ID et
--    le Client Secret dans ce même écran, puis activez le provider.
-- 2. Désactivez le provider Email (Authentication > Providers > Email)
--    si vous ne voulez que la connexion Discord — voir le README.
-- 3. Connectez-vous une première fois sur le site avec VOTRE compte
--    Discord : cela crée automatiquement votre profil ET votre fiche
--    joueur (voir handle_new_user() plus haut).
-- 4. Copiez votre UID (Authentication > Users, colonne "UID", dans le
--    dashboard Supabase), puis exécutez la ligne ci-dessous pour vous
--    passer administrateur :
--
-- update public.profiles set is_admin = true where id = 'VOTRE_UID';
-- ============================================================
