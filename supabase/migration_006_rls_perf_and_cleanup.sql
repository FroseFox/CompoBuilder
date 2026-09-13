-- ============================================================
-- Comp Builder — migration 006
-- Nettoyage RLS relevé par l'advisor de sécurité/performance Supabase :
--
-- 1. Remplace auth.uid() par (select auth.uid()) dans toutes les
--    policies d'écriture : Postgres évalue l'appel une seule fois par
--    requête au lieu d'une fois par ligne (perf à l'échelle).
-- 2. Remplace les policies "Ecriture admin X" (FOR ALL, qui couvrait
--    aussi SELECT et faisait donc doublon avec la policy de lecture
--    publique dédiée) par des policies séparées insert/update/delete.
--
-- Sans danger à exécuter sur une base déjà en production : ne change
-- aucune donnée, seulement les règles d'accès (avec le même
-- comportement final : lecture publique, écriture admin uniquement).
-- ============================================================

drop policy if exists "Lecture propre profil" on public.profiles;
create policy "Lecture propre profil" on public.profiles for select
  using ((select auth.uid()) = id);

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
