-- ============================================================
-- Migration 008 : matchs programmés (à venir)
--
-- Jusqu'ici, un match ne pouvait exister que déjà joué (score
-- obligatoire, défaut 0-0). On autorise maintenant our_score /
-- opponent_score à être NULL : un match dont les deux scores sont NULL
-- est considéré "programmé" (à venir), pas encore joué. Voir
-- isMatchPlayed() dans src/utils/matches.js — c'est ce qui distingue
-- un match programmé d'un match joué, sans colonne de statut dédiée.
-- ============================================================

alter table public.matches alter column our_score drop not null;
alter table public.matches alter column opponent_score drop not null;
