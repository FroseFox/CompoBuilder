import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useLiveSync } from '../hooks/useLiveSync'
import { deleteMatchRow, fetchMatches, fetchMatchWithMaps, insertMatch, updateMatchRow } from '../services/db'
import { useToast } from './ToastContext'

const MatchesContext = createContext(null)

export function MatchesProvider({ children }) {
  const { pushToast } = useToast()
  const [matches, setMatches] = useState({})
  const [status, setStatus] = useState('loading')

  const mergeMatch = useCallback((match) => {
    setMatches((prev) => ({ ...prev, [match.id]: match }))
  }, [])

  const removeMatchFromState = useCallback((id) => {
    setMatches((prev) => {
      if (!prev[id]) return prev
      const next = { ...prev }
      delete next[id]
      return next
    })
  }, [])

  const load = useCallback(async () => {
    try {
      const list = await fetchMatches()
      const byId = {}
      list.forEach((m) => (byId[m.id] = m))
      setMatches(byId)
      setStatus('ready')
    } catch (err) {
      console.error(err)
      setStatus((s) => (s === 'ready' ? s : 'error'))
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Recharge un match précis (avec ses manches) suite à un évènement
  // temps réel — un payload postgres_changes ne contient que les
  // colonnes de LA table concernée, jamais la ressource imbriquée
  // match_maps(*) : impossible de reconstituer un match complet à
  // partir du seul payload, d'où ce refetch ciblé. Le match a pu
  // disparaître entre-temps (ex. suppression en cascade des manches
  // d'un match lui-même supprimé) : on ignore alors silencieusement.
  const refreshMatch = useCallback(
    async (matchId) => {
      if (!matchId) return
      try {
        mergeMatch(await fetchMatchWithMaps(matchId))
      } catch {
        // Le match n'existe plus (déjà supprimé) — rien à synchroniser.
      }
    },
    [mergeMatch]
  )

  // Synchronisation temps réel entre tous les membres de l'équipe.
  // Suppression d'une manche : seul son id arrive ; on retrouve son match
  // dans l'état local pour le recharger.
  const matchesRef = useRef(matches)
  useEffect(() => {
    matchesRef.current = matches
  }, [matches])
  useLiveSync(
    'matches',
    [
      {
        table: 'cb_matches',
        onUpsert: (p) => refreshMatch(p.new.id),
        onDelete: (p) => removeMatchFromState(p.old.id),
      },
      {
        table: 'cb_match_maps',
        onUpsert: (p) => refreshMatch(p.new.match_id),
        onDelete: (p) => {
          const owner = Object.values(matchesRef.current).find((m) => m.maps.some((mm) => mm.id === p.old.id))
          if (owner) refreshMatch(owner.id)
        },
      },
    ],
    load
  )

  const handleError = useCallback(
    (err, fallbackMessage) => {
      console.error(err)
      const message =
        err?.code === '42501' || /row-level security/i.test(err?.message || '')
          ? "Action refusée : seuls le capitaine et les éditeurs de l'équipe peuvent modifier."
          : fallbackMessage
      pushToast(message, 'error')
    },
    [pushToast]
  )

  const createMatch = useCallback(
    async (draft, mapsDraft) => {
      try {
        const match = await insertMatch(draft, mapsDraft)
        mergeMatch(match)
        return match.id
      } catch (err) {
        handleError(err, "Impossible d'enregistrer ce match.")
        return null
      }
    },
    [mergeMatch, handleError]
  )

  // mapsDraft omis (undefined) = les manches ne changent pas (ex. un
  // simple renommage d'adversaire) ; un tableau, même vide, les remplace.
  const updateMatch = useCallback(
    async (id, patch, mapsDraft) => {
      try {
        const updated = await updateMatchRow(id, patch, mapsDraft)
        mergeMatch(updated)
      } catch (err) {
        handleError(err, 'Impossible de mettre à jour ce match.')
      }
    },
    [mergeMatch, handleError]
  )

  const deleteMatch = useCallback(
    async (id) => {
      try {
        await deleteMatchRow(id)
        removeMatchFromState(id)
      } catch (err) {
        handleError(err, 'Impossible de supprimer ce match.')
      }
    },
    [removeMatchFromState, handleError]
  )

  const value = useMemo(
    () => ({ matches, status, createMatch, updateMatch, deleteMatch }),
    [matches, status, createMatch, updateMatch, deleteMatch]
  )

  return <MatchesContext.Provider value={value}>{children}</MatchesContext.Provider>
}

export function useMatches() {
  const ctx = useContext(MatchesContext)
  if (!ctx) throw new Error('useMatches doit être utilisé dans MatchesProvider')
  return ctx
}
