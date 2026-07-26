import { useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { upsertAgents, upsertMaps } from '../services/db'

/**
 * Tient les tables Supabase `maps` et `agents` à jour à partir des
 * données live de valorant-api.com. Ces deux tables ne servent que de
 * référence (intégrité des compositions, futures statistiques) : les
 * images et noms affichés dans l'app viennent toujours de l'API en direct.
 *
 * Ne s'exécute que pour un compte administrateur, car l'écriture est
 * réservée aux admins par les policies Supabase (RLS) — les autres
 * membres n'ont de toute façon pas le droit d'écrire dans ces tables.
 */
export function useGameDataSync() {
  const { isAdmin } = useAuth()
  const { maps, agents, status } = useData()
  const hasSynced = useRef(false)

  useEffect(() => {
    if (!isAdmin || status !== 'ready' || hasSynced.current) return
    if (maps.length === 0 || agents.length === 0) return

    hasSynced.current = true
    Promise.all([upsertMaps(maps), upsertAgents(agents)]).catch((err) => {
      console.error('Synchronisation des données de jeu impossible :', err)
      hasSynced.current = false
    })
  }, [isAdmin, status, maps, agents])
}
