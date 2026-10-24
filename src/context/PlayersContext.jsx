import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { useLiveSync } from '../hooks/useLiveSync'
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

  const load = useCallback(async () => {
    try {
      const list = await fetchPlayers()
      const byId = {}
      list.forEach((p) => (byId[p.id] = p))
      setPlayers(byId)
      setStatus('ready')
    } catch (err) {
      console.error(err)
      setStatus((s) => (s === 'ready' ? s : 'error'))
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Effectif en direct : un joueur qui rejoint l'équipe sur le réseau
  // apparaît ici tout seul (sa fiche est créée par la base).
  useLiveSync(
    'players',
    [
      {
        table: 'cb_players',
        onUpsert: (payload) => mergePlayer(rowToPlayer(payload.new)),
        onDelete: (payload) => removePlayerFromState(payload.old.id),
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

  const addPlayer = useCallback(async (data) => {
    try {
      const player = await insertPlayer(data)
      mergePlayer(player)
      return player.id
    } catch (err) {
      handleError(err, "Impossible d'ajouter ce joueur.")
      return null
    }
  }, [mergePlayer, handleError])

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
    [players, mergePlayer, handleError]
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
    [removePlayerFromState, handleError]
  )

  return (
    <PlayersContext.Provider
      value={{ players, status, addPlayer, updatePlayer, deletePlayer, reload: load }}
    >
      {children}
    </PlayersContext.Provider>
  )
}

export function usePlayers() {
  const ctx = useContext(PlayersContext)
  if (!ctx) throw new Error('usePlayers doit être utilisé dans PlayersProvider')
  return ctx
}
