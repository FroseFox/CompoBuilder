import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from '../services/supabaseClient'
import {
  deletePlayerRow,
  fetchPlayers,
  insertPlayer,
  rowToPlayer,
  updatePlayerRow,
} from '../services/db'
import { useToast } from './ToastContext'

const PlayersContext = createContext(null)

export function PlayersProvider({ children }) {
  const { pushToast } = useToast()
  const [players, setPlayers] = useState({})
  const [status, setStatus] = useState('loading')

  const mergePlayer = useCallback((player) => {
    setPlayers((prev) => ({ ...prev, [player.id]: player }))
  }, [])

  const removePlayerFromState = useCallback((id) => {
    setPlayers((prev) => {
      if (!prev[id]) return prev
      const next = { ...prev }
      delete next[id]
      return next
    })
  }, [])

  useEffect(() => {
    let cancelled = false
    fetchPlayers()
      .then((list) => {
        if (cancelled) return
        const byId = {}
        list.forEach((p) => (byId[p.id] = p))
        setPlayers(byId)
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

  // Synchronisation temps réel de l'effectif entre tous les membres connectés.
  useEffect(() => {
    const channel = supabase
      .channel('players-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'players' }, (payload) => {
        mergePlayer(rowToPlayer(payload.new))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'players' }, (payload) => {
        mergePlayer(rowToPlayer(payload.new))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'players' }, (payload) => {
        removePlayerFromState(payload.old.id)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [mergePlayer, removePlayerFromState])

  const handleError = (err, fallbackMessage) => {
    console.error(err)
    const message =
      err?.code === '42501' || /row-level security/i.test(err?.message || '')
        ? "Action refusée : vous devez être connecté en tant qu'administrateur."
        : fallbackMessage
    pushToast(message, 'error')
  }

  const addPlayer = useCallback(async (data) => {
    try {
      const player = await insertPlayer(data)
      mergePlayer(player)
      return player.id
    } catch (err) {
      handleError(err, "Impossible d'ajouter ce joueur.")
      return null
    }
  }, [mergePlayer])

  const updatePlayer = useCallback(
    async (id, patch) => {
      try {
        const current = players[id]
        const merged = { ...current, ...patch }
        const player = await updatePlayerRow(id, merged)
        mergePlayer(player)
      } catch (err) {
        handleError(err, 'Impossible de mettre à jour ce joueur.')
      }
    },
    [players, mergePlayer]
  )

  const deletePlayer = useCallback(
    async (id) => {
      try {
        await deletePlayerRow(id)
        removePlayerFromState(id)
      } catch (err) {
        handleError(err, 'Impossible de supprimer ce joueur.')
      }
    },
    [removePlayerFromState]
  )

  return (
    <PlayersContext.Provider value={{ players, status, addPlayer, updatePlayer, deletePlayer }}>
      {children}
    </PlayersContext.Provider>
  )
}

export function usePlayers() {
  const ctx = useContext(PlayersContext)
  if (!ctx) throw new Error('usePlayers doit être utilisé dans PlayersProvider')
  return ctx
}
