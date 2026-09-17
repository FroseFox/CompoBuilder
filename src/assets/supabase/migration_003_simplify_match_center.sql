-- ============================================================
-- Comp Builder — migration 003
-- Remplace la structure Match Center (matches + match_maps) par un
-- simple historique de matchs joués : un match = une map, un score,
-- un adversaire, une composition utilisée.
--
-- À exécuter si vous aviez déjà appliqué la migration 002 (celle qui
-- créait les tables "matches" et "match_maps" avec la logique
-- BO1/BO3/BO5 + plusieurs maps par match). Si vous n'aviez jamais
-- exécuté la migration 002, ce script fonctionne aussi sans problème.
--
-- ⚠️ Ce script supprime les tables "matches" et "match_maps" si elles
-- existent, avec toutes les données qu'elles contiennent, pour les
-- recréer avec la nouvelle structure simplifiée. Si vous aviez déjà
-- enregistré de vrais matchs avec l'ancienne version, sauvegardez-les
-- avant (Table Editor > matches > exporter en CSV) : cette mise à
-- jour ne peut pas convertir automatiquement l'ancien format
-- (plusieurs maps par match) vers le nouveau (une map par match).
--
-- À exécuter dans : Supabase Dashboard > votre projet > SQL Editor >
-- New query > coller tout ce fichier > Run.
-- ============================================================

drop table if exists public.match_maps cascade;
drop table if exists public.matches cascade;

-- Redondant avec la migration 002 si vous l'aviez déjà exécutée (sans
-- danger de la relancer) : garantit que le statut "todo" est bien
-- autorisé sur les compositions, même si ce script est exécuté seul.
alter table public.compositions drop constraint if exists compositions_status_check;
alter table public.compositions
  add constraint compositions_status_check
  check (status in ('validated', 'testing', 'needs_work', 'todo'));

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  opponent_name text not null,
  map_uuid text not null references public.maps(uuid),
  composition_id uuid references public.compositions(id) on delete set null,
  our_score int not null default 0,
  opponent_score int not null default 0,
  match_date date,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.matches enable row level security;

create policy "Lecture publique matches" on public.matches for select using (true);

create policy "Ecriture admin matches" on public.matches for all
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true))
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

alter publication supabase_realtime add table public.matches;
