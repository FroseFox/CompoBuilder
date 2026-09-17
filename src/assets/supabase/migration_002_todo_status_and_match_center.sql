-- ============================================================
-- Comp Builder — migration 002
-- Ajoute : le statut "todo" (À faire), et les tables du Match Center
-- (matches, match_maps).
--
-- Sans danger à exécuter sur une base déjà en production : toutes les
-- instructions sont protégées (if not exists / if exists), aucune
-- donnée existante n'est supprimée ou modifiée.
--
-- À exécuter en une seule fois dans : Supabase Dashboard > votre
-- projet > SQL Editor > New query > coller tout ce fichier > Run.
-- ============================================================

-- ---------- 1. Statut "todo" sur les compositions ----------
-- La contrainte existante n'autorisait que validated/testing/needs_work.
-- On la remplace pour inclure "todo" (⚪ À faire).

alter table public.compositions drop constraint if exists compositions_status_check;
alter table public.compositions
  add constraint compositions_status_check
  check (status in ('validated', 'testing', 'needs_work', 'todo'));

-- ---------- 2. Tables du Match Center ----------

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  opponent_name text not null,
  opponent_logo_url text,
  tournament text,
  match_date date,
  match_time time,
  format text not null default 'bo3' check (format in ('bo1', 'bo3', 'bo5')),
  status text not null default 'todo' check (status in ('validated', 'testing', 'needs_work', 'todo')),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.match_maps (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  map_uuid text not null references public.maps(uuid),
  composition_id uuid references public.compositions(id) on delete set null,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists match_maps_match_id_idx on public.match_maps (match_id);

-- ---------- 3. Sécurité (RLS) — même principe que les autres tables ----------
-- Lecture publique pour tout le monde, écriture réservée aux admins.

alter table public.matches enable row level security;
alter table public.match_maps enable row level security;

drop policy if exists "Lecture publique matches" on public.matches;
create policy "Lecture publique matches" on public.matches for select using (true);

drop policy if exists "Lecture publique match_maps" on public.match_maps;
create policy "Lecture publique match_maps" on public.match_maps for select using (true);

drop policy if exists "Ecriture admin matches" on public.matches;
create policy "Ecriture admin matches" on public.matches for all
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true))
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

drop policy if exists "Ecriture admin match_maps" on public.match_maps;
create policy "Ecriture admin match_maps" on public.match_maps for all
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true))
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

-- ---------- 4. Temps réel ----------

alter publication supabase_realtime add table public.matches;
alter publication supabase_realtime add table public.match_maps;
