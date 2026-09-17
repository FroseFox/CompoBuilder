-- Type de match (Scrim / Match officiel) + support des rappels Discord.
--
-- 1) `type` : catégorise chaque entrée du Match Center comme "scrim" ou
--    "match" — remplace l'affichage centré sur l'adversaire ("VS X") par
--    une simple étiquette, l'adversaire devenant secondaire/optionnel.
-- 2) `opponent_name` devient optionnel (un scrim interne, ou un match dont
--    on ne connaît pas encore l'adversaire, n'a pas forcément ce champ).
-- 3) `reminder_sent_at` : horodatage du dernier rappel Discord envoyé pour
--    ce match, pour ne jamais en envoyer deux (voir send_match_reminders()
--    plus bas, planifiée via pg_cron).

alter table public.matches
  add column if not exists type text not null default 'match' check (type in ('scrim', 'match'));

alter table public.matches
  alter column opponent_name drop not null;

alter table public.matches
  add column if not exists reminder_sent_at timestamptz;

comment on column public.matches.type is 'Catégorie de l''entrée : ''scrim'' (entraînement) ou ''match'' (match officiel).';
comment on column public.matches.reminder_sent_at is 'Horodatage du rappel Discord envoyé pour ce match (évite les doublons) — voir send_match_reminders().';

-- ============================================================
-- Rappels automatiques via le bot Discord (webhook), sans serveur
-- dédié : le site est statique (GitHub Pages), donc c'est Postgres
-- lui-même qui doit déclencher l'envoi sur une planification —
-- pg_cron (planification) + pg_net (appel HTTP sortant asynchrone
-- vers le webhook Discord, directement depuis la base).
--
-- Logique d'un rappel par match (voir send_match_reminders) :
--   - avec une heure renseignée : dès qu'il reste 1h ou moins avant le
--     coup d'envoi (et qu'il n'est pas déjà passé) ;
--   - sans heure renseignée (date seule) : dès que la date programmée
--     est celle du jour (le premier passage de la tâche ce jour-là).
-- Un seul rappel par match quel que soit le cas, marqué par
-- reminder_sent_at pour ne jamais le renvoyer.
-- ============================================================

-- Schéma fixe imposé par chacune de ces deux extensions (non relocalisables) :
-- pas de "with schema", sinon échec à la création.
create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public.send_match_reminders()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  webhook text;
  m record;
  label text;
  title text;
  when_text text;
begin
  select discord_webhook_url into webhook from public.team_settings where id = true;
  if webhook is null or webhook = '' then
    return;
  end if;

  for m in
    select id, type, opponent_name, format, match_date, match_time
    from public.matches
    where reminder_sent_at is null
      and match_date is not null
      and not exists (
        select 1 from public.match_maps mm
        where mm.match_id = matches.id and mm.our_score is not null and mm.opponent_score is not null
      )
      and (
        (match_time is not null and (match_date + match_time) - now() <= interval '1 hour' and (match_date + match_time) > now())
        or (match_time is null and match_date = current_date)
      )
  loop
    label := case when m.type = 'scrim' then 'Scrim' else 'Match' end;
    title := label || case when m.opponent_name is not null and m.opponent_name <> '' then ' contre ' || m.opponent_name else '' end;
    when_text := to_char(m.match_date, 'DD/MM/YYYY') || case when m.match_time is not null then ' à ' || to_char(m.match_time, 'HH24:MI') else '' end;

    perform net.http_post(
      url := webhook,
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := jsonb_build_object(
        'username', 'MatchNotif',
        'embeds', jsonb_build_array(jsonb_build_object(
          'title', '⏰ Rappel — ' || title,
          'description', 'C''est bientôt l''heure : ' || when_text || '.',
          'color', 16731733
        ))
      )
    );

    update public.matches set reminder_sent_at = now() where id = m.id;
  end loop;
end;
$$;

comment on function public.send_match_reminders() is 'Envoie un rappel Discord (webhook) pour chaque match/scrim à venir dont le créneau approche et qui n''a pas déjà reçu de rappel. Planifiée via pg_cron, voir cron.schedule ci-dessous.';

select cron.schedule(
  'match-reminders',
  '*/10 * * * *',
  $$select public.send_match_reminders();$$
) where not exists (select 1 from cron.job where jobname = 'match-reminders');
