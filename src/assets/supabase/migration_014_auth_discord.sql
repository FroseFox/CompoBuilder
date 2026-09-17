-- ============================================================
-- Migration 014 : connexion Discord = l'effectif lui-même.
--
-- Remplace le compte email + mot de passe (migration_013) par une
-- connexion Discord : se connecter avec Discord crée automatiquement la
-- fiche joueur (pseudo repris de Discord), plus besoin qu'un admin la
-- crée ni qu'un joueur l'associe à la main. Le rôle admin reste réglable
-- par compte dans Supabase (table profiles), inchangé.
--
-- Retirer quelqu'un de l'effectif ne suffit pas à faire un simple
-- "supprimer le compte" : supprimer un compte Supabase NE révoque PAS
-- l'autorisation OAuth Discord sous-jacente, la personne peut se
-- reconnecter instantanément et se voir recréer un compte. La nouvelle
-- table banned_discord_ids + la fonction ban_and_remove_player() sont la
-- vraie mémoire de "cette personne ne doit plus réapparaître".
-- ============================================================

-- ---------- 1. Identifiant Discord stable sur players ----------

alter table public.players add column if not exists discord_id text;
create unique index if not exists players_discord_id_key on public.players (discord_id);
create index if not exists players_discord_id_idx on public.players (discord_id);

-- ---------- 2. Liste noire Discord ----------

create table if not exists public.banned_discord_ids (
  discord_id text primary key,
  banned_by uuid references auth.users(id) on delete set null,
  reason text,
  created_at timestamptz not null default now()
);

alter table public.banned_discord_ids enable row level security;

drop policy if exists "Lecture admin banned_discord_ids" on public.banned_discord_ids;
create policy "Lecture admin banned_discord_ids" on public.banned_discord_ids for select
  using (exists (select 1 from public.profiles where id = (select auth.uid()) and is_admin = true));

drop policy if exists "Ecriture admin banned_discord_ids" on public.banned_discord_ids;
create policy "Ecriture admin banned_discord_ids" on public.banned_discord_ids for insert
  with check (exists (select 1 from public.profiles where id = (select auth.uid()) and is_admin = true));

drop policy if exists "Suppression admin banned_discord_ids" on public.banned_discord_ids;
create policy "Suppression admin banned_discord_ids" on public.banned_discord_ids for delete
  using (exists (select 1 from public.profiles where id = (select auth.uid()) and is_admin = true));

-- ---------- 3. Auto-création de la fiche joueur à la connexion Discord ----------

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

-- ---------- 4. Retrait d'effectif avec bannissement ----------

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
-- Étapes manuelles restantes (dashboard Supabase / Discord) :
--
-- 1. Discord Developer Portal > New Application > OAuth2 : notez le
--    Client ID et le Client Secret.
-- 2. Supabase Dashboard > Authentication > Providers > Discord : collez
--    Client ID / Client Secret, activez le provider. La page vous donne
--    le redirect URI à coller côté Discord.
-- 3. Authentication > Providers > Email : désactivez-le si vous ne
--    voulez plus que la connexion Discord (le front-end ne propose de
--    toute façon plus le formulaire email + mot de passe après cette
--    migration).
-- 4. Les fiches déjà présentes dans players AVANT cette migration
--    n'ont pas de discord_id : si l'un de ces joueurs se connecte via
--    Discord, une SECONDE fiche sera créée automatiquement (rien ne
--    permet de deviner que "Toothpaste" la fiche et "Toothpaste" le
--    compte Discord sont la même personne). Le plus simple est de
--    supprimer la fiche manuelle en double une fois que la personne
--    s'est connectée, ou de lui coller son discord_id à la main :
--    voir le README, section Comptes et droits.
-- ============================================================
