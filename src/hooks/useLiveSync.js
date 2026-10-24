import { useEffect, useLayoutEffect, useRef } from 'react'
import { supabase } from '../services/supabaseClient'
import { teamFilter } from '../services/team'

/**
 * Temps réel limité à l'équipe courante + rattrapage automatique.
 *
 * - INSERT/UPDATE filtrés sur team_id : on ne reçoit que les changements
 *   de son équipe (moins de messages, quota gratuit préservé).
 * - DELETE : Supabase ne sait pas filtrer les suppressions ; on ne reçoit
 *   que l'id de la ligne supprimée, ce qui ne révèle rien.
 * - Si la connexion temps réel a sauté (veille, wifi coupé) ou si l'onglet
 *   est resté caché plus de 30 s, on recharge une fois pour rattraper ce
 *   qui a pu être manqué.
 *
 * @param {string} name     nom du canal
 * @param {Array<{table: string, onUpsert?: Function, onDelete?: Function}>} specs
 * @param {Function} reload rechargement complet
 */
export function useLiveSync(name, specs, reload) {
  const ref = useRef({ specs, reload })
  useLayoutEffect(() => {
    ref.current = { specs, reload }
  })

  useEffect(() => {
    let wasDown = false
    let channel = supabase.channel(`${name}-${Math.random().toString(36).slice(2, 8)}`)
    ref.current.specs.forEach(({ table, onUpsert, onDelete }) => {
      if (onUpsert) {
        const cb = (p) => ref.current.specs.find((s) => s.table === table)?.onUpsert?.(p)
        channel = channel
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table, filter: teamFilter() }, cb)
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table, filter: teamFilter() }, cb)
      }
      if (onDelete) {
        channel = channel.on('postgres_changes', { event: 'DELETE', schema: 'public', table }, (p) =>
          ref.current.specs.find((s) => s.table === table)?.onDelete?.(p)
        )
      }
    })
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        if (wasDown) ref.current.reload()
        wasDown = false
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        wasDown = true
      }
    })

    let hiddenAt = 0
    const onVisibility = () => {
      if (document.hidden) hiddenAt = Date.now()
      else if (hiddenAt && Date.now() - hiddenAt > 30000) {
        hiddenAt = 0
        ref.current.reload()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      supabase.removeChannel(channel)
    }
  }, [name])
}
