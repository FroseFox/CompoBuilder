-- Migration 015 : lien VOD sur les matchs
--
-- Ajoute un champ texte libre `vod_url` sur public.matches : un lien
-- vers le replay du match (Twitch, YouTube…), saisi à la main par un
-- admin dans le formulaire du Match Center. Aucune contrainte de
-- format côté base (un simple texte) — la validation "ressemble à une
-- URL" se fait côté formulaire (input type="url").
--
-- Aucun changement de policy RLS nécessaire : les policies existantes
-- sur public.matches ("Lecture publique matches",
-- "Ecriture/Modification/Suppression admin matches") s'appliquent à la
-- ligne entière, colonne comprise.

alter table public.matches add column if not exists vod_url text;
