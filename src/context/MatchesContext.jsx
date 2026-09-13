import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../services/supabaseClient'
import { deleteMatchRow, fetchMatches, insertMatch, rowToMatch, updateMatchRow } from '../services/db'
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

  // Chargement initial depuis Supabase.
  useEffect(() => {
    let cancelled = false
    fetchMatches()
      .then((list) => {
        if (cancelled) return
        const byId = {}
        list.forEach((m) => (byId[m.id] = m))
        setMatches(byId)
        setStatus('ready')
      })
      .catch((err) => {
        console.error(err)
        if (!cancelled) setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Synchronisation temps réel entre tous les membres connectés.
  useEffect(() => {
    const channel = supabase
      .channel('matches-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'matches' }, (p) => mergeMatch(rowToMatch(p.new)))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches' }, (p) => mergeMatch(rowToMatch(p.new)))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'matches' }, (p) => removeMatchFromState(p.old.id))
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [mergeMatch, removeMatchFromState])

  const handleError = useCallback(
    (err, fallbackMessage) => {
      console.error(err)
      const message =
        err?.code === '42501' || /row-level security/i.test(err?.message || '')
          ? "Action refusée : vous devez être connecté en tant qu'administrateur."
          : fallbackMessage
      pushToast(message, 'error')
    },
    [pushToast]
  )

  const createMatch = useCallback(
    async (draft) => {
      try {
        const match = await insertMatch(draft)
        mergeMatch(match)
        return match.id
      } catch (err) {
        handleError(err, "Impossible d'enregistrer ce match.")
        return null
      }
    },
    [mergeMatch, handleError]
  )

  const updateMatch = useCallback(
    async (id, patch) => {
      try {
        const updated = await updateMatchRow(id, patch)
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
