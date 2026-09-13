-- ============================================================
-- Comp Builder — migration 004
-- Ajoute au Match Center : un logo d'adversaire (lien) et un ordre
-- d'affichage manuel (glisser-déposer dans l'interface).
--
-- Sans danger à exécuter sur une base déjà en production : aucune
-- donnée existante n'est supprimée.
--
-- À exécuter dans : Supabase Dashboard > votre projet > SQL Editor >
-- New query > coller tout ce fichier > Run.
--
-- NOTE (mise à jour ultérieure) : la page qui utilisait ces deux
-- colonnes (l'ancienne page de détail de match, avec logo et tri par
-- glisser-déposer) a depuis été retirée du code — voir le README,
-- section "Fonctionnalités volontairement retirées". Ces colonnes
-- restent en base sans effet ; pas besoin d'exécuter cette migration
-- sur une base neuve, et pas nécessaire non plus de les supprimer
-- d'une base existante (elles ne gênent rien).
-- ============================================================

alter table public.matches
  add column if not exists opponent_logo_url text;

alter table public.matches
  add column if not exists position int not null default 0;

-- Initialise l'ordre des matchs déjà existants d'après leur date de
-- création, pour que le tri par glisser-déposer parte d'un état
-- cohérent au lieu que tout le monde ait position = 0.
with ordered as (
  select id, row_number() over (order by created_at asc) - 1 as rn
  from public.matches
)
update public.matches m
set position = ordered.rn
from ordered
where ordered.id = m.id;

create index if not exists matches_position_idx on public.matches (position);
