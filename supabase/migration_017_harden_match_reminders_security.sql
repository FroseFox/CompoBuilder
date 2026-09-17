-- Corrige deux avertissements du linter de sécurité soulevés par la
-- migration précédente (match_type_and_reminders) :
--
-- 1) pg_net s'était installé dans le schéma "public" (comportement par
--    défaut de l'extension) — recommandé par Supabase de le déplacer
--    hors de public. On la réinstalle dans le schéma dédié "extensions".
-- 2) send_match_reminders() est SECURITY DEFINER mais n'a aucune raison
--    d'être appelable via l'API REST (PostgREST expose par défaut toute
--    fonction du schéma public aux rôles anon/authenticated) : seul
--    pg_cron (qui s'exécute en tant que propriétaire de la fonction,
--    indépendamment des droits REST) doit pouvoir la déclencher.

drop extension if exists pg_net;
create extension if not exists pg_net with schema extensions;

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

    perform extensions.http_post(
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

revoke all on function public.send_match_reminders() from public, anon, authenticated;

select cron.schedule(
  'match-reminders',
  '*/10 * * * *',
  $$select public.send_match_reminders();$$
) where not exists (select 1 from cron.job where jobname = 'match-reminders');
