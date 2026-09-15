-- ============================================================
-- Migration 010 : vote Discord (validation de compo) + validation
-- de présence (match programmé).
--
-- Aucune nouvelle table : chaque vote est 1-1 avec sa composition ou
-- son match, donc on ajoute directement les colonnes qui le
-- concernent — mêmes policies RLS que la ligne qui les porte (déjà
-- admin-only en écriture, lecture publique).
-- ============================================================

-- ---------- Vote de validation d'une composition ----------
-- vote_status = 'open' tant que le vote n'a pas été résolu par un
-- admin (bouton "Résoudre" dans l'app) ; repasse à NULL une fois
-- résolu (le résultat est déjà reflété par `status`, pas besoin de
-- garder de trace du vote lui-même).
alter table public.compositions
  add column if not exists vote_status text check (vote_status is null or vote_status = 'open'),
  add column if not exists vote_message_id text,
  add column if not exists vote_channel_id text;

-- ---------- Validation de présence pour un match programmé ----------
-- Comptage global (pas de lien à un joueur précis) des réactions
-- ✅/❌ sur le message Discord envoyé à la programmation du match.
alter table public.matches
  add column if not exists presence_message_id text,
  add column if not exists presence_channel_id text,
  add column if not exists presence_yes integer,
  add column if not exists presence_no integer,
  add column if not exists presence_synced_at timestamptz;
