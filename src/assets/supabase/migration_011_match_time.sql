-- ============================================================
-- Migration 011 : heure du match (en plus de la date).
--
-- Optionnelle : un match sans heure renseignée reste valide (affichage
-- "à définir" côté app, comme pour une date absente).
-- ============================================================

alter table public.matches
  add column if not exists match_time time;
