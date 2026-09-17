-- ============================================================
-- Migration 007 : réglages d'équipe (webhook Discord)
--
-- Ajoute une table à une seule ligne (singleton) pour stocker des
-- réglages partagés par toute l'équipe — pour l'instant, l'URL du
-- webhook Discord utilisé pour notifier automatiquement l'ajout d'un
-- match et la validation d'une composition.
--
-- Lecture ET écriture réservées aux administrateurs : contrairement
-- aux autres tables (lecture publique), l'URL d'un webhook doit rester
-- secrète — n'importe qui la récupérant pourrait poster des messages
-- dans votre salon Discord depuis l'extérieur de l'application.
-- ============================================================

create table if not exists public.team_settings (
  -- Astuce "singleton" : la clé primaire ne peut valoir que `true`
  -- (contrainte ci-dessous), donc une seule ligne peut jamais exister.
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
