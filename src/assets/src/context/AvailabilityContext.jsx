import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from '../services/supabaseClient'
import {
  addAvailabilitySlot,
  fetchAvailability,
  removeAvailabilitySlot,
  rowToAvailability,
} from '../services/db'
import { useToast } from './ToastContext'

const AvailabilityContext = createContext(null)

// Rappel : contrairement aux autres tables, l'écriture sur
// `player_availability` n'est réservée ni à tout le monde ni aux seuls
// admins : chaque compte ne peut modifier que la ligne du joueur auquel
// il est associé (voir claimPlayer dans PlayersContext), plus les admins
// qui gardent la main. handleError traduit un refus RLS en conséquence.

export function AvailabilityProvider({ children }) {
  const { pushToast } = useToast()
  // Indexé par id de ligne (et non par joueur/jour/période) pour que les
  // suppressions temps réel fonctionnent même si Supabase ne renvoie que
  // l'id dans payload.old (comportement par défaut sans REPLICA IDENTITY
  // FULL sur la table).
  const [slots, setSlots] = useState({})
  const [status, setStatus] = useState('loading')

  const mergeSlot = useCallback((slot) => {
    setSlots((prev) => ({ ...prev, [slot.id]: slot }))
  }, [])

  const removeSlotFromState = useCallback((id) => {
    setSlots((prev) => {
      if (!prev[id]) return prev
      const next = { ...prev }
      delete next[id]
      return next
    })
  }, [])

  useEffect(() => {
    let cancelled = false
    fetchAvailability()
      .then((list) => {
        if (cancelled) return
        const byId = {}
        list.forEach((slot) => (byId[slot.id] = slot))
        setSlots(byId)
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

  // Synchronisation temps réel : quand un joueur coche/décoche un
  // créneau depuis un autre onglet ou un autre appareil, tout le monde
  // voit la grille se mettre à jour instantanément.
  useEffect(() => {
    const channel = supabase
      .channel('player-availability-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'player_availability' }, (payload) => {
        mergeSlot(rowToAvailability(payload.new))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'player_availability' }, (payload) => {
        removeSlotFromState(payload.old.id)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [mergeSlot, removeSlotFromState])

  const handleError = useCallback(
    (err, fallbackMessage) => {
      console.error(err)
      const message =
        err?.code === '42501' || /row-level security/i.test(err?.message || '')
          ? "Action refusée : tu ne peux modifier que tes propres disponibilités."
          : fallbackMessage
      pushToast(message, 'error')
    },
    [pushToast]
  )

  /** Bascule un créneau (date × période) pour un joueur donné. */
  const toggleSlot = useCallback(
    async (playerId, date, period) => {
      const existing = Object.values(slots).find(
        (s) => s.playerId === playerId && s.date === date && s.period === period
      )
      try {
        if (existing) {
          await removeAvailabilitySlot(playerId, date, period)
          removeSlotFromState(existing.id)
        } else {
          const slot = await addAvailabilitySlot(playerId, date, period)
          mergeSlot(slot)
        }
      } catch (err) {
        handleError(err, 'Impossible de mettre à jour cette disponibilité.')
      }
    },
    [slots, mergeSlot, removeSlotFromState, handleError]
  )

  const value = { slots, status, toggleSlot }

  return <AvailabilityContext.Provider value={value}>{children}</AvailabilityContext.Provider>
}

export function useAvailability() {
  const ctx = useContext(AvailabilityContext)
  if (!ctx) throw new Error('useAvailability doit être utilisé dans AvailabilityProvider')
  return ctx
}
