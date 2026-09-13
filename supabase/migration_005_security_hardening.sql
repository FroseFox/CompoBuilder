-- ============================================================
-- Comp Builder — migration 005
-- Corrige une dérive de sécurité découverte lors d'un check-up :
--
-- 1. La colonne `profiles.is_admin` avait un défaut à `true` au lieu
--    de `false` sur la base en production. Avec le trigger
--    `handle_new_user`, ça donnait automatiquement les droits admin à
--    tout nouveau compte créé (n'importe qui pouvant s'inscrire via
--    l'API Supabase, la clé anon étant publique par design). Aucune
--    ligne `profiles` n'existait avec is_admin = true au moment du
--    correctif (donc pas d'admin non désiré à révoquer), mais la
--    faille était activement exploitable.
--
-- 2. La fonction `handle_new_user` (SECURITY DEFINER) n'avait pas de
--    search_path figé et restait exécutable publiquement via l'API
--    REST (/rest/v1/rpc/handle_new_user), alors qu'elle ne doit être
--    déclenchée que par le trigger interne.
--
-- Sans danger à exécuter sur une base déjà en production, aucune
-- donnée n'est supprimée ou modifiée.
-- ============================================================

alter table public.profiles alter column is_admin set default false;

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, is_admin) values (new.id, false)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function public.handle_new_user() from public;

-- ============================================================
-- Complément à faire manuellement dans le Dashboard Supabase
-- (pas possible en SQL) :
--
-- 1. Authentication > Providers > Email > désactiver "Allow new users
--    to sign up" — l'app ne propose l'inscription à personne, aucune
--    raison de la laisser ouverte publiquement.
-- 2. Authentication > Policies > activer "Leaked password protection"
--    (vérifie les mots de passe compromis via HaveIBeenPwned).
-- ============================================================
