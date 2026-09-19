-- Ajoute un moyen simple de promouvoir un coéquipier administrateur
-- directement depuis la page Équipe, sans toucher au SQL Editor à chaque
-- fois (jusqu'ici seule la commande manuelle `update public.profiles set
-- is_admin = true where id = '...'` le permettait — voir GUIDE_SUPABASE.md
-- étape 6). Cette migration reste nécessaire une seule fois : elle crée
-- deux fonctions RPC, réservées aux administrateurs existants.
--
-- set_player_admin(target_player_id, make_admin) : bascule le droit admin
-- d'un joueur déjà connecté au moins une fois avec Discord (sa fiche doit
-- avoir un user_id — une fiche créée à la main et jamais reliée à un
-- compte ne peut pas devenir admin, il n'y a pas de compte à promouvoir).
--
-- list_admin_player_ids() : liste les fiches joueur dont le compte est
-- déjà admin, pour afficher l'état actuel sur la page Équipe (la table
-- `profiles` ne s'expose qu'à son propre titulaire en lecture directe,
-- d'où le passage par une fonction SECURITY DEFINER même pour la lecture).

create or replace function public.set_player_admin(target_player_id uuid, make_admin boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_admin = true) then
    raise exception 'Réservé aux administrateurs.';
  end if;

  select user_id into v_user_id from public.players where id = target_player_id;

  if v_user_id is null then
    raise exception 'Ce joueur doit s''être connecté au moins une fois avec Discord avant de pouvoir devenir administrateur.';
  end if;

  update public.profiles set is_admin = make_admin where id = v_user_id;
end;
$$;

revoke all on function public.set_player_admin(uuid, boolean) from public;
grant execute on function public.set_player_admin(uuid, boolean) to authenticated;

create or replace function public.list_admin_player_ids()
returns table(player_id uuid)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_admin = true) then
    raise exception 'Réservé aux administrateurs.';
  end if;

  return query
    select p.id
    from public.players p
    join public.profiles pr on pr.id = p.user_id
    where pr.is_admin = true;
end;
$$;

revoke all on function public.list_admin_player_ids() from public;
grant execute on function public.list_admin_player_ids() to authenticated;
