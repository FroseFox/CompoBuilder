// ============================================================
// Fonctions dérivées pour l'historique des matchs (Match Center).
// ============================================================

export const MATCH_RESULT = {
  WIN: 'win',
  LOSS: 'loss',
  DRAW: 'draw',
}

export const MATCH_RESULT_META = {
  [MATCH_RESULT.WIN]: { label: 'Victoire', color: '#3ddc97' },
  [MATCH_RESULT.LOSS]: { label: 'Défaite', color: '#ff5f6d' },
  [MATCH_RESULT.DRAW]: { label: 'Nul', color: '#c7cdd6' },
}

/**
 * Un match est "joué" si les deux scores sont renseignés. Un match dont
 * our_score/opponent_score valent NULL est un match "programmé" (à
 * venir) — pas de colonne de statut dédiée, juste l'absence de score.
 */
export function isMatchPlayed(match) {
  return match.ourScore !== null && match.ourScore !== undefined && match.opponentScore !== null && match.opponentScore !== undefined
}

/** Résultat d'un match à partir du score. */
export function computeMatchResult(match) {
  if (match.ourScore > match.opponentScore) return MATCH_RESULT.WIN
  if (match.ourScore < match.opponentScore) return MATCH_RESULT.LOSS
  return MATCH_RESULT.DRAW
}

function emptyRecord() {
  return { played: 0, wins: 0, losses: 0, draws: 0 }
}

function addToRecord(record, result) {
  record.played += 1
  if (result === MATCH_RESULT.WIN) record.wins += 1
  else if (result === MATCH_RESULT.LOSS) record.losses += 1
  else record.draws += 1
}

function winRate(record) {
  if (record.played === 0) return 0
  return Math.round((record.wins / record.played) * 100)
}

/** Bilan global (victoires/défaites/nuls, taux de victoire) sur tout l'historique. */
export function computeOverallRecord(matches) {
  const record = emptyRecord()
  matches.forEach((m) => addToRecord(record, computeMatchResult(m)))
  return { ...record, winRate: winRate(record) }
}

/** Bilan par map, trié par nombre de matchs joués (les plus jouées d'abord). */
export function computeMapStats(matches, maps) {
  const mapByUuid = new Map(maps.map((m) => [m.uuid, m]))
  const byMap = new Map()

  matches.forEach((match) => {
    if (!byMap.has(match.mapUuid)) byMap.set(match.mapUuid, emptyRecord())
    addToRecord(byMap.get(match.mapUuid), computeMatchResult(match))
  })

  return [...byMap.entries()]
    .map(([mapUuid, record]) => ({
      mapUuid,
      mapName: mapByUuid.get(mapUuid)?.name || 'Map inconnue',
      mapThumbnail: mapByUuid.get(mapUuid)?.thumbnail,
      ...record,
      winRate: winRate(record),
    }))
    .sort((a, b) => b.played - a.played || b.winRate - a.winRate)
}

/**
 * Bilan par composition utilisée, regroupé par map : pour chaque map,
 * la liste de ses compositions triée par taux de victoire (la
 * meilleure en premier, marquée isBest). Seuls les matchs avec une
 * composition assignée comptent.
 */
export function computeCompositionStatsByMap(matches, compositionsByMap, maps) {
  const mapByUuid = new Map(maps.map((m) => [m.uuid, m]))
  const byMapThenComp = new Map()

  matches.forEach((match) => {
    if (!match.compositionId) return
    const comp = Object.values(compositionsByMap[match.mapUuid] || {}).find((c) => c.id === match.compositionId)
    if (!comp) return

    if (!byMapThenComp.has(match.mapUuid)) byMapThenComp.set(match.mapUuid, new Map())
    const byComp = byMapThenComp.get(match.mapUuid)

    if (!byComp.has(comp.id)) {
      byComp.set(comp.id, { compositionId: comp.id, compositionName: comp.name, ...emptyRecord() })
    }
    addToRecord(byComp.get(comp.id), computeMatchResult(match))
  })

  return [...byMapThenComp.entries()]
    .map(([mapUuid, byComp]) => {
      const compositions = [...byComp.values()]
        .map((entry) => ({ ...entry, winRate: winRate(entry) }))
        .sort((a, b) => b.winRate - a.winRate || b.played - a.played)
        .map((entry, index) => ({ ...entry, isBest: index === 0 }))

      const totalPlayed = compositions.reduce((sum, c) => sum + c.played, 0)

      return {
        mapUuid,
        mapName: mapByUuid.get(mapUuid)?.name || 'Map inconnue',
        mapThumbnail: mapByUuid.get(mapUuid)?.thumbnail,
        totalPlayed,
        compositions,
      }
    })
    .sort((a, b) => b.totalPlayed - a.totalPlayed)
}

/** Bilan face à chaque adversaire rencontré, trié par nombre de confrontations. */
export function computeOpponentStats(matches) {
  const byOpponent = new Map()

  matches.forEach((match) => {
    const key = match.opponentName.trim().toLowerCase()
    if (!byOpponent.has(key)) {
      byOpponent.set(key, { opponentName: match.opponentName, ...emptyRecord() })
    }
    addToRecord(byOpponent.get(key), computeMatchResult(match))
  })

  return [...byOpponent.values()]
    .map((entry) => ({ ...entry, winRate: winRate(entry) }))
    .sort((a, b) => b.played - a.played)
}

/**
 * Bilan par joueur : pour chaque joueur de l'effectif, son taux de
 * victoire sur les matchs où il figurait dans la composition utilisée,
 * ainsi que l'agent qu'il a le plus souvent joué. Seuls les matchs avec
 * une composition assignée comptent ; un joueur sans aucun match
 * n'apparaît pas dans le résultat.
 */
export function computePlayerStats(matches, compositionsByMap, players, agents) {
  const agentByUuid = new Map(agents.map((a) => [a.uuid, a]))
  const byPlayer = new Map()

  matches.forEach((match) => {
    if (!match.compositionId) return
    const comp = Object.values(compositionsByMap[match.mapUuid] || {}).find((c) => c.id === match.compositionId)
    if (!comp) return

    const result = computeMatchResult(match)

    comp.slots.forEach((slot) => {
      if (!slot.playerId || !players[slot.playerId]) return

      if (!byPlayer.has(slot.playerId)) {
        byPlayer.set(slot.playerId, { ...emptyRecord(), agentCounts: new Map() })
      }
      const entry = byPlayer.get(slot.playerId)
      addToRecord(entry, result)

      if (slot.agentUuid) {
        entry.agentCounts.set(slot.agentUuid, (entry.agentCounts.get(slot.agentUuid) || 0) + 1)
      }
    })
  })

  return [...byPlayer.entries()]
    .map(([playerId, entry]) => {
      let topAgent = null
      let topCount = 0
      entry.agentCounts.forEach((count, agentUuid) => {
        if (count > topCount) {
          topCount = count
          topAgent = agentByUuid.get(agentUuid) || null
        }
      })

      return {
        playerId,
        player: players[playerId],
        played: entry.played,
        wins: entry.wins,
        losses: entry.losses,
        draws: entry.draws,
        winRate: winRate(entry),
        topAgent,
      }
    })
    .sort((a, b) => b.played - a.played || b.winRate - a.winRate)
}

/** Les N matchs les plus récents (par date si renseignée, sinon par création), du plus ancien au plus récent. */
export function getRecentForm(matches, count = 8) {
  const sorted = [...matches].sort((a, b) => {
    const aKey = a.matchDate || null
    const bKey = b.matchDate || null
    if (aKey && bKey) return aKey.localeCompare(bKey)
    if (aKey) return 1
    if (bKey) return -1
    return a.createdAt - b.createdAt
  })
  return sorted.slice(-count)
}
