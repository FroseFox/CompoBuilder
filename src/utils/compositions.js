// ============================================================
// Fonctions dérivées, pures, opérant sur la structure de données
// des compositions. Isolées ici pour être réutilisées par la
// page d'accueil, le dashboard, les cartes de map et la recherche
// globale — sans dupliquer la logique d'agrégation.
// ============================================================

import { STATUS } from './storage'

/** Toutes les compositions d'une map, triées (principale d'abord, puis plus récente). */
export function getCompsForMap(compositionsByMap, mapUuid) {
  const bucket = compositionsByMap[mapUuid]
  if (!bucket) return []
  return Object.values(bucket).sort((a, b) => {
    if (a.isMain !== b.isMain) return a.isMain ? -1 : 1
    return b.updatedAt - a.updatedAt
  })
}

/** La composition "principale" d'une map, ou la plus récente à défaut, ou null. */
export function getMainComposition(compositionsByMap, mapUuid) {
  const comps = getCompsForMap(compositionsByMap, mapUuid)
  return comps.find((c) => c.isMain) || comps[0] || null
}

export function countFilled(comp) {
  if (!comp) return 0
  return comp.slots.filter((s) => s.agentUuid).length
}

export function isCompComplete(comp) {
  return countFilled(comp) === 5
}

/** true si au moins un agent a été placé dans au moins une composition de la map. */
export function hasAnyProgress(compositionsByMap, mapUuid) {
  return getCompsForMap(compositionsByMap, mapUuid).some((c) => countFilled(c) > 0)
}

export function lastModifiedForMap(compositionsByMap, mapUuid) {
  const comps = getCompsForMap(compositionsByMap, mapUuid)
  if (comps.length === 0) return null
  return Math.max(...comps.map((c) => c.updatedAt))
}

/** Résumé condensé d'une map, prêt à être affiché sur une carte. */
export function summarizeMap(compositionsByMap, mapUuid) {
  const comps = getCompsForMap(compositionsByMap, mapUuid)
  const main = comps.find((c) => c.isMain) || comps[0] || null
  return {
    compsCount: comps.length,
    mainComp: main,
    filledCount: countFilled(main),
    status: main?.status || null,
    lastModified: comps.length ? Math.max(...comps.map((c) => c.updatedAt)) : null,
    hasProgress: comps.some((c) => countFilled(c) > 0),
  }
}

/** Statistiques globales, pour le tableau de bord. */
export function computeDashboardStats(compositionsByMap, maps) {
  const buckets = { [STATUS.VALIDATED]: 0, [STATUS.TESTING]: 0, [STATUS.NEEDS_WORK]: 0 }
  let empty = 0
  let totalCompositions = 0

  maps.forEach((map) => {
    const comps = getCompsForMap(compositionsByMap, map.uuid)
    totalCompositions += comps.length
    if (comps.length === 0) {
      empty += 1
      return
    }
    const main = comps.find((c) => c.isMain) || comps[0]
    buckets[main.status] = (buckets[main.status] || 0) + 1
  })

  const totalMaps = maps.length
  const completed = buckets[STATUS.VALIDATED]

  return {
    totalMaps,
    totalCompositions,
    validated: buckets[STATUS.VALIDATED],
    testing: buckets[STATUS.TESTING],
    needsWork: buckets[STATUS.NEEDS_WORK],
    empty,
    progressPercent: totalMaps === 0 ? 0 : Math.round((completed / totalMaps) * 100),
  }
}

/** Formatage relatif type "il y a 2 jours" en français, sans dépendance externe. */
export function formatRelativeDate(timestamp) {
  if (!timestamp) return 'Jamais modifiée'

  const diffMs = Date.now() - timestamp
  const diffMin = Math.round(diffMs / 60000)
  const diffH = Math.round(diffMs / 3600000)
  const diffDay = Math.round(diffMs / 86400000)

  if (diffMin < 1) return "À l'instant"
  if (diffMin < 60) return `Il y a ${diffMin} min`
  if (diffH < 24) return `Il y a ${diffH} h`
  if (diffDay === 1) return 'Hier'
  if (diffDay < 7) return `Il y a ${diffDay} j`

  return new Date(timestamp).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
