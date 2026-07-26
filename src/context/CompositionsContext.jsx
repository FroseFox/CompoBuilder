import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../services/supabaseClient'
import {
  deleteAllCompositions,
  deleteCompositionRow,
  fetchCompositions,
  insertComposition,
  rowToComposition,
  updateCompositionRow,
} from '../services/db'
import { STATUS, defaultCompositionDraft, emptySlots } from '../utils/storage'
import { useToast } from './ToastContext'

const CompositionsContext = createContext(null)

/** Regroupe la liste plate de compositions par map, comme attendu par le reste de l'app. */
function groupByMap(list) {
  const byMap = {}
  list.forEach((comp) => {
    if (!byMap[comp.mapUuid]) byMap[comp.mapUuid] = {}
    byMap[comp.mapUuid][comp.id] = comp
  })
  return byMap
}

export function CompositionsProvider({ children }) {
  const { pushToast } = useToast()
  const [compositionsByMap, setCompositionsByMap] = useState({})
  const [status, setStatus] = useState('loading') // loading | ready | error

  const mergeComp = useCallback((comp) => {
    setCompositionsByMap((prev) => ({
      ...prev,
      [comp.mapUuid]: { ...(prev[comp.mapUuid] || {}), [comp.id]: comp },
    }))
  }, [])

  const removeCompFromState = useCallback((mapUuid, compId) => {
    setCompositionsByMap((prev) => {
      const bucket = prev[mapUuid]
      if (!bucket) return prev
      const rest = { ...bucket }
      delete rest[compId]
      return { ...prev, [mapUuid]: rest }
    })
  }, [])

  // Chargement initial depuis Supabase.
  useEffect(() => {
    let cancelled = false
    fetchCompositions()
      .then((list) => {
        if (cancelled) return
        setCompositionsByMap(groupByMap(list))
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

  // Synchronisation temps réel : toute modification faite par un autre
  // membre de l'équipe (ou un autre onglet) met à jour l'état localement,
  // sans recharger la page.
  useEffect(() => {
    const channel = supabase
      .channel('compositions-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'compositions' }, (payload) => {
        mergeComp(rowToComposition(payload.new))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'compositions' }, (payload) => {
        mergeComp(rowToComposition(payload.new))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'compositions' }, (payload) => {
        removeCompFromState(payload.old.map_uuid, payload.old.id)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [mergeComp, removeCompFromState])

  const handleError = (err, fallbackMessage) => {
    console.error(err)
    const message =
      err?.code === '42501' || /row-level security/i.test(err?.message || '')
        ? "Action refusée : vous devez être connecté en tant qu'administrateur."
        : fallbackMessage
    pushToast(message, 'error')
  }

  const createComposition = useCallback(
    async (mapUuid, name) => {
      try {
        const bucket = compositionsByMap[mapUuid] || {}
        const hasMain = Object.values(bucket).some((c) => c.isMain)
        const draft = defaultCompositionDraft(name, { isMain: !hasMain })
        const comp = await insertComposition(mapUuid, draft)
        mergeComp(comp)
        return comp.id
      } catch (err) {
        handleError(err, 'Impossible de créer la composition.')
        return null
      }
    },
    [compositionsByMap, mergeComp]
  )

  const duplicateComposition = useCallback(
    async (mapUuid, compId) => {
      try {
        const source = compositionsByMap[mapUuid]?.[compId]
        if (!source) return null
        const draft = {
          name: `${source.name} (copie)`,
          slots: source.slots.map((s) => ({ ...s })),
          status: source.status,
          notes: source.notes,
          isMain: false,
        }
        const comp = await insertComposition(mapUuid, draft)
        mergeComp(comp)
        return comp.id
      } catch (err) {
        handleError(err, 'Impossible de dupliquer la composition.')
        return null
      }
    },
    [compositionsByMap, mergeComp]
  )

  const deleteComposition = useCallback(
    async (mapUuid, compId) => {
      try {
        const bucket = compositionsByMap[mapUuid] || {}
        const wasMain = bucket[compId]?.isMain
        await deleteCompositionRow(compId)
        removeCompFromState(mapUuid, compId)

        if (wasMain) {
          const remaining = Object.values(bucket).filter((c) => c.id !== compId)
          if (remaining.length > 0) {
            const newest = remaining.sort((a, b) => b.updatedAt - a.updatedAt)[0]
            const updated = await updateCompositionRow(newest.id, { isMain: true })
            mergeComp(updated)
          }
        }
      } catch (err) {
        handleError(err, 'Impossible de supprimer la composition.')
      }
    },
    [compositionsByMap, mergeComp, removeCompFromState]
  )

  const renameComposition = useCallback(
    async (mapUuid, compId, name) => {
      try {
        const updated = await updateCompositionRow(compId, { name })
        mergeComp(updated)
      } catch (err) {
        handleError(err, 'Impossible de renommer la composition.')
      }
    },
    [mergeComp]
  )

  const setMain = useCallback(
    async (mapUuid, compId) => {
      try {
        const bucket = compositionsByMap[mapUuid] || {}
        const others = Object.values(bucket).filter((c) => c.id !== compId && c.isMain)
        await Promise.all(others.map((c) => updateCompositionRow(c.id, { isMain: false }).then(mergeComp)))
        const updated = await updateCompositionRow(compId, { isMain: true })
        mergeComp(updated)
      } catch (err) {
        handleError(err, 'Impossible de définir la composition principale.')
      }
    },
    [compositionsByMap, mergeComp]
  )

  const setStatus_ = useCallback(
    async (mapUuid, compId, statusValue) => {
      try {
        const updated = await updateCompositionRow(compId, { status: statusValue })
        mergeComp(updated)
      } catch (err) {
        handleError(err, 'Impossible de changer le statut.')
      }
    },
    [mergeComp]
  )

  const setNotes = useCallback(
    async (mapUuid, compId, notes) => {
      try {
        const updated = await updateCompositionRow(compId, { notes })
        mergeComp(updated)
      } catch (err) {
        handleError(err, 'Impossible de sauvegarder les notes.')
      }
    },
    [mergeComp]
  )

  const patchSlots = useCallback(
    async (mapUuid, compId, mutate) => {
      try {
        const current = compositionsByMap[mapUuid]?.[compId]
        if (!current) return
        const nextSlots = mutate(current.slots)
        const updated = await updateCompositionRow(compId, { slots: nextSlots })
        mergeComp(updated)
      } catch (err) {
        handleError(err, "Impossible de mettre à jour la composition.")
      }
    },
    [compositionsByMap, mergeComp]
  )

  const setSlotAgent = useCallback(
    (mapUuid, compId, slotIndex, agentUuid) =>
      patchSlots(mapUuid, compId, (slots) => slots.map((s, i) => (i === slotIndex ? { ...s, agentUuid } : s))),
    [patchSlots]
  )

  const setSlotPlayer = useCallback(
    (mapUuid, compId, slotIndex, playerId) =>
      patchSlots(mapUuid, compId, (slots) => slots.map((s, i) => (i === slotIndex ? { ...s, playerId } : s))),
    [patchSlots]
  )

  const removeSlot = useCallback(
    (mapUuid, compId, slotIndex) =>
      patchSlots(mapUuid, compId, (slots) =>
        slots.map((s, i) => (i === slotIndex ? { agentUuid: null, playerId: null } : s))
      ),
    [patchSlots]
  )

  const reorderSlots = useCallback(
    (mapUuid, compId, fromIndex, toIndex) =>
      patchSlots(mapUuid, compId, (slots) => {
        const next = [...slots]
        ;[next[fromIndex], next[toIndex]] = [next[toIndex], next[fromIndex]]
        return next
      }),
    [patchSlots]
  )

  const clearComposition = useCallback(
    (mapUuid, compId) => patchSlots(mapUuid, compId, () => emptySlots()),
    [patchSlots]
  )

  /** Utilisé quand un joueur est supprimé de l'effectif : on le retire de tous les slots. */
  const unassignPlayerEverywhere = useCallback(
    async (playerId) => {
      const affected = []
      Object.values(compositionsByMap).forEach((bucket) => {
        Object.values(bucket).forEach((comp) => {
          if (comp.slots.some((s) => s.playerId === playerId)) affected.push(comp)
        })
      })
      await Promise.all(
        affected.map(async (comp) => {
          const nextSlots = comp.slots.map((s) => (s.playerId === playerId ? { ...s, playerId: null } : s))
          const updated = await updateCompositionRow(comp.id, { slots: nextSlots })
          mergeComp(updated)
        })
      ).catch((err) => handleError(err, 'Impossible de désassigner ce joueur partout.'))
    },
    [compositionsByMap, mergeComp]
  )

  const resetAll = useCallback(async () => {
    try {
      await deleteAllCompositions()
      setCompositionsByMap({})
    } catch (err) {
      handleError(err, 'Impossible de réinitialiser les compositions.')
    }
  }, [])

  const value = useMemo(
    () => ({
      compositionsByMap,
      status,
      createComposition,
      duplicateComposition,
      deleteComposition,
      renameComposition,
      setMain,
      setStatus: setStatus_,
      setNotes,
      setSlotAgent,
      setSlotPlayer,
      removeSlot,
      reorderSlots,
      clearComposition,
      unassignPlayerEverywhere,
      resetAll,
    }),
    [
      compositionsByMap,
      status,
      createComposition,
      duplicateComposition,
      deleteComposition,
      renameComposition,
      setMain,
      setStatus_,
      setNotes,
      setSlotAgent,
      setSlotPlayer,
      removeSlot,
      reorderSlots,
      clearComposition,
      unassignPlayerEverywhere,
      resetAll,
    ]
  )

  return <CompositionsContext.Provider value={value}>{children}</CompositionsContext.Provider>
}

export function useCompositions() {
  const ctx = useContext(CompositionsContext)
  if (!ctx) throw new Error('useCompositions doit être utilisé dans CompositionsProvider')
  return ctx
}

export { STATUS }
