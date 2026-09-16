-- ============================================================
-- Migration 013 : comptes joueurs + calendrier réel pour les
-- disponibilités.
--
-- Deux changements, demandés ensemble :
--
-- 1. La grille de disponibilités (migration_012) utilisait des jours de
--    semaine récurrents (lundi, mardi, ...). Elle utilise maintenant de
--    vraies dates de calendrier, pour pouvoir se caler sur les matchs
--    réellement programmés (table `matches`). Comme il n'existe aucun
--    moyen fiable de convertir un ancien "lundi" en une date précise,
--    les créneaux déjà cochés sous l'ancien système sont supprimés — à
--    recocher une fois cette migration appliquée.
--
-- 2. Un vrai système de compte (email + mot de passe) permet à chaque
--    joueur d'associer son compte à sa fiche dans l'effectif
--    (public.claim_player), et seul ce compte (ou un admin) peut
--    désormais cocher ses disponibilités — l'ancienne version laissait
--    n'importe qui modifier la disponibilité de n'importe quel joueur.
-- ============================================================

-- ---------- 1. Comptes joueurs ----------

alter table public.players
  add column if not exists user_id uuid unique references auth.users(id) on delete set null;

create index if not exists players_user_id_idx on public.players (user_id);

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

-- ---------- 2. Dates réelles au lieu du jour de semaine récurrent ----------

alter table public.player_availability add column if not exists date date;

-- Aucun moyen de déduire une date à partir d'un jour de semaine seul :
-- les anciens créneaux (migration_012) sont supprimés plutôt que
-- laissés avec une date arbitraire/fausse.
delete from public.player_availability where date is null;

alter table public.player_availability alter column date set not null;
alter table public.player_availability drop column if exists day_of_week;

alter table public.player_availability drop constraint if exists player_availability_player_id_day_of_week_period_key;
alter table public.player_availability
  add constraint player_availability_player_id_date_period_key unique (player_id, date, period);

create index if not exists player_availability_date_idx on public.player_availability (date);

-- ---------- 3. Écriture restreinte au compte associé (ou un admin) ----------
-- Remplace la policy "libre" de la migration_012 : maintenant que les
-- comptes existent, seul le compte associé à un joueur (ou un admin)
-- peut modifier SA disponibilité.

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
