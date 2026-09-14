-- ============================================================
-- Migration 009 : format Best of 1/3/5 + manches par match
--
-- Jusqu'ici, un "match" ne portait qu'une seule map (une seule ligne
-- map_uuid/composition_id/our_score/opponent_score). Pour supporter un
-- vrai format Best of 1/3/5, chaque match peut désormais contenir
-- plusieurs "manches" (une par map jouée), chacune avec sa propre
-- composition et son propre score — table match_maps ci-dessous.
--
-- Le score affiché au niveau du match (ex. "2 – 1") devient le nombre
-- de manches gagnées par chaque équipe, calculé côté client à partir
-- de match_maps (voir computeMatchResult dans src/utils/matches.js) ;
-- les anciennes colonnes our_score/opponent_score/map_uuid/
-- composition_id sur `matches`, propres à une seule map, n'ont plus de
-- sens et sont donc supprimées après migration des données existantes.
-- ============================================================

-- 1. Format de la série (Bo1 par défaut : équivalent au comportement
--    précédent, une seule map).
alter table public.matches
  add column if not exists format text not null default 'bo1' check (format in ('bo1', 'bo3', 'bo5'));

-- 2. Table des manches.
create table if not exists public.match_maps (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  position integer not null default 0,
  map_uuid text references public.maps(uuid),
  composition_id uuid references public.compositions(id) on delete set null,
  -- Mêmes règles que l'ancien our_score/opponent_score du match : NULL
  -- sur les deux colonnes = manche pas encore jouée.
  our_score integer,
  opponent_score integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (match_id, position)
);

create index if not exists match_maps_match_id_idx on public.match_maps (match_id);
create index if not exists match_maps_map_uuid_idx on public.match_maps (map_uuid);
create index if not exists match_maps_composition_id_idx on public.match_maps (composition_id);

-- 3. Migration des données existantes : chaque match devient sa
--    propre manche n°0 (comportement identique à avant, en Bo1).
--    Sans condition "where not exists" ce insert ne serait pas rejouable
--    sans risque de doublons — comme le reste de ce fichier se veut
--    idempotent, on protège l'insertion.
insert into public.match_maps (match_id, position, map_uuid, composition_id, our_score, opponent_score)
select m.id, 0, m.map_uuid, m.composition_id, m.our_score, m.opponent_score
from public.matches m
where not exists (select 1 from public.match_maps mm where mm.match_id = m.id);

-- 4. Les colonnes propres à une seule map n'ont plus lieu d'être sur
--    `matches` une fois les données reprises dans match_maps.
drop index if exists matches_map_uuid_idx;
drop index if exists matches_composition_id_idx;
alter table public.matches drop column if exists map_uuid;
alter table public.matches drop column if exists composition_id;
alter table public.matches drop column if exists our_score;
alter table public.matches drop column if exists opponent_score;

-- 5. RLS : mêmes règles que sur `matches` (lecture publique, écriture
--    admin uniquement).
alter table public.match_maps enable row level security;

drop policy if exists "Lecture publique match_maps" on public.match_maps;
create policy "Lecture publique match_maps" on public.match_maps for select using (true);

drop policy if exists "Ecriture admin match_maps" on public.match_maps;
create policy "Ecriture admin match_maps" on public.match_maps for insert
  with check (exists (select 1 from public.profiles where id = (select auth.uid()) and is_admin = true));
create policy "Modification admin match_maps" on public.match_maps for update
  using (exists (select 1 from public.profiles where id = (select auth.uid()) and is_admin = true))
  with check (exists (select 1 from public.profiles where id = (select auth.uid()) and is_admin = true));
create policy "Suppression admin match_maps" on public.match_maps for delete
  using (exists (select 1 from public.profiles where id = (select auth.uid()) and is_admin = true));

-- 6. Temps réel : les manches doivent se synchroniser entre les
--    membres connectés comme le reste.
alter publication supabase_realtime add table public.match_maps;
