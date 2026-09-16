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
// `player_availability` n'est pas réservée aux admins (voir
// supabase/schema.sql). Le handleError ci-dessous garde quand même le
// même filet de sécurité "row-level security" au cas où la policy
// serait durcie plus tard.

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
          ? "Action refusée par la base de données."
          : fallbackMessage
      pushToast(message, 'error')
    },
    [pushToast]
  )

  /** Bascule un créneau (jour × période) pour un joueur donné. */
  const toggleSlot = useCallback(
    async (playerId, day, period) => {
      const existing = Object.values(slots).find(
        (s) => s.playerId === playerId && s.day === day && s.period === period
      )
      try {
        if (existing) {
          await removeAvailabilitySlot(playerId, day, period)
          removeSlotFromState(existing.id)
        } else {
          const slot = await addAvailabilitySlot(playerId, day, period)
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
