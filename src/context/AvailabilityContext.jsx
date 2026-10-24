import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { useLiveSync } from '../hooks/useLiveSync'
import {
  addAvailabilitySlot,
  fetchAvailability,
  removeAvailabilitySlot,
  rowToAvailability,
} from '../services/db'
import { useToast } from './ToastContext'

const AvailabilityContext = createContext(null)

// Rappel : chaque joueur ne peut cocher que ses propres créneaux (sa fiche
// est reliée à son compte), le capitaine et les éditeurs peuvent dépanner.

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

  const load = useCallback(async () => {
    try {
      const list = await fetchAvailability()
      const byId = {}
      list.forEach((slot) => (byId[slot.id] = slot))
      setSlots(byId)
      setStatus('ready')
    } catch (err) {
      console.error(err)
      setStatus((s) => (s === 'ready' ? s : 'error'))
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Temps réel : quand un joueur coche ou décoche un créneau, toute
  // l'équipe voit la grille bouger instantanément.
  useLiveSync(
    'availability',
    [
      {
        table: 'cb_availability',
        onUpsert: (payload) => mergeSlot(rowToAvailability(payload.new)),
        onDelete: (payload) => removeSlotFromState(payload.old.id),
      },
    ],
    load
  )

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
