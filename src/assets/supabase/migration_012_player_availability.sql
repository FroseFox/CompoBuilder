-- ============================================================
-- Migration 012 : disponibilités des joueurs.
--
-- Une grille hebdomadaire (jour × période de la journée) où chaque
-- joueur coche ses créneaux disponibles, pour repérer facilement le
-- meilleur moment commun pour caler une session d'entraînement.
--
-- Différence volontaire avec le reste du schéma : l'écriture n'est PAS
-- réservée aux comptes administrateur. L'intérêt de cette table est que
-- chaque joueur coche directement ses propres créneaux, sans compte ni
-- validation admin — comme le reste du site, l'accès reste par lien
-- privé, mais gardez à l'esprit que quiconque a ce lien peut modifier
-- la disponibilité de n'importe quel joueur (pas seulement la sienne),
-- un peu comme un tableur partagé "en écriture" sans restriction de
-- compte. Si ça devient un problème, il faudra réintroduire un contrôle
-- (comptes par joueur, par exemple).
-- ============================================================

create table if not exists public.player_availability (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  -- 0 = lundi ... 6 = dimanche
  day_of_week smallint not null check (day_of_week between 0 and 6),
  period text not null check (period in ('morning', 'afternoon', 'evening')),
  created_at timestamptz not null default now(),
  unique (player_id, day_of_week, period)
);

create index if not exists player_availability_player_id_idx on public.player_availability (player_id);

alter table public.player_availability enable row level security;

drop policy if exists "Lecture publique player_availability" on public.player_availability;
create policy "Lecture publique player_availability" on public.player_availability for select using (true);

drop policy if exists "Ecriture libre player_availability" on public.player_availability;
create policy "Ecriture libre player_availability" on public.player_availability for insert with check (true);

drop policy if exists "Suppression libre player_availability" on public.player_availability;
create policy "Suppression libre player_availability" on public.player_availability for delete using (true);

alter publication supabase_realtime add table public.player_availability;
