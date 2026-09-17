// ============================================================
// Fonctions dérivées pour l'historique des matchs (Match Center).
//
// Un match est une série dans un format Best of 1/3/5 : ses manches
// (une par map jouée), chacune avec sa propre composition et son
// propre score, vivent dans match.maps (voir rowToMatch dans
// src/services/db.js). Le "score du match" n'est jamais stocké tel
// quel : il se déduit des manches, ici.
// ============================================================

export const MATCH_FORMAT = {
  BO1: 'bo1',
  BO3: 'bo3',
  BO5: 'bo5',
}

/** maxMaps : nombre maximum de manches pour ce format (une série s'arrête dès qu'un camp a la majorité). */
export const FORMAT_META = {
  [MATCH_FORMAT.BO1]: { label: 'Bo1', maxMaps: 1, winsNeeded: 1 },
  [MATCH_FORMAT.BO3]: { label: 'Bo3', maxMaps: 3, winsNeeded: 2 },
  [MATCH_FORMAT.BO5]: { label: 'Bo5', maxMaps: 5, winsNeeded: 3 },
}

export const MATCH_RESULT = {
  WIN: 'win',
  LOSS: 'loss',
  DRAW: 'draw',
}

// Catégorie d'une entrée du Match Center — remplace l'affichage centré
// sur l'adversaire ("VS X") : l'étiquette Scrim/Match est désormais
// l'information affichée en priorité, l'adversaire devenant secondaire
// et optionnel (voir migration_016_match_type_and_reminders.sql).
export const MATCH_TYPE = {
  SCRIM: 'scrim',
  MATCH: 'match',
}

// accent-cyan (déjà utilisé pour les repères "à venir"/planification) pour
// un scrim d'entraînement ; brand-red (couleur principale du site) pour un
// match officiel — deux teintes déjà chargées de sens ailleurs dans l'app.
export const MATCH_TYPE_META = {
  [MATCH_TYPE.SCRIM]: { label: 'Scrim', color: 'var(--accent-cyan)' },
  [MATCH_TYPE.MATCH]: { label: 'Match', color: 'var(--brand-red)' },
}

// Alignées sur les tokens de rôle déjà utilisés partout ailleurs dans
// l'app (voir STATUS_META dans storage.js) plutôt que des couleurs
// codées en dur : un seul jeu de teintes sémantiques pour toute l'app.
export const MATCH_RESULT_META = {
  [MATCH_RESULT.WIN]: { label: 'Victoire', color: 'var(--role-sentinel)' },
  [MATCH_RESULT.LOSS]: { label: 'Défaite', color: 'var(--role-duelist)' },
  [MATCH_RESULT.DRAW]: { label: 'Nul', color: 'var(--role-flex)' },
}

/** Une manche est "jouée" si les deux scores sont renseignés. */
export function isMapEntryPlayed(mapEntry) {
  return (
    mapEntry.ourScore !== null &&
    mapEntry.ourScore !== undefined &&
    mapEntry.opponentScore !== null &&
    mapEntry.opponentScore !== undefined
  )
}

function mapEntryResult(mapEntry) {
  if (mapEntry.ourScore > mapEntry.opponentScore) return MATCH_RESULT.WIN
  if (mapEntry.ourScore < mapEntry.opponentScore) return MATCH_RESULT.LOSS
  return MATCH_RESULT.DRAW
}

/**
 * Un match est "joué" dès qu'au moins une de ses manches a un score —
 * une série en cours (1 map faite sur 3) a sa place dans l'historique,
 * pas dans "à venir". Un match dont aucune manche n'a de score est
 * "programmé" (à venir).
 */
export function isMatchPlayed(match) {
  return (match.maps || []).some(isMapEntryPlayed)
}

/** Nombre de manches gagnées par chaque camp (les seules manches jouées comptent). */
export function computeSeriesScore(match) {
  let ourWins = 0
  let opponentWins = 0
  ;(match.maps || []).forEach((m) => {
    if (!isMapEntryPlayed(m)) return
    if (m.ourScore > m.opponentScore) ourWins += 1
    else if (m.ourScore < m.opponentScore) opponentWins += 1
  })
  return { ourWins, opponentWins }
}

/** Résultat de la série (majorité de manches gagnées). */
export function computeMatchResult(match) {
  const { ourWins, opponentWins } = computeSeriesScore(match)
  if (ourWins > opponentWins) return MATCH_RESULT.WIN
  if (ourWins < opponentWins) return MATCH_RESULT.LOSS
  return MATCH_RESULT.DRAW
}

/**
 * Une série est "décidée" dès qu'un camp a la majorité de manches
 * requise par son format, ou que toutes les manches possibles ont été
 * jouées. Sert à distinguer un Bo3 mené 1-0 (en cours, résultat pas
 * encore acquis) d'un Bo3 réellement terminé — computeMatchResult
 * répondrait "Victoire" dans les deux cas sans cette distinction.
 */
export function isSeriesDecided(match) {
  const { ourWins, opponentWins } = computeSeriesScore(match)
  const { winsNeeded, maxMaps } = FORMAT_META[match.format] || FORMAT_META[MATCH_FORMAT.BO1]
  const playedCount = (match.maps || []).filter(isMapEntryPlayed).length
  return ourWins >= winsNeeded || opponentWins >= winsNeeded || playedCount >= maxMaps
}

/**
 * Score à afficher pour un match : en Bo1, le score de la manche
 * elle-même (ex. "13 – 8", comme avant) puisqu'il n'y a qu'une seule
 * map ; en Bo3/Bo5, le nombre de manches gagnées par camp (ex. "2 – 1").
 */
export function formatSeriesScore(match) {
  const firstMap = (match.maps || [])[0]
  if (match.format === MATCH_FORMAT.BO1 && firstMap && isMapEntryPlayed(firstMap)) {
    return `${firstMap.ourScore} – ${firstMap.opponentScore}`
  }
  const { ourWins, opponentWins } = computeSeriesScore(match)
  return `${ourWins} – ${opponentWins}`
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

/** Bilan global (victoires/défaites/nuls, taux de victoire) sur tout l'historique — au niveau série. */
export function computeOverallRecord(matches) {
  const record = emptyRecord()
  matches.forEach((m) => addToRecord(record, computeMatchResult(m)))
  return { ...record, winRate: winRate(record) }
}

/** Toutes les manches jouées de tous les matchs, à plat (chaque manche = une contribution indépendante aux stats par map/composition). */
function playedMapEntries(matches) {
  const out = []
  matches.forEach((match) => {
    ;(match.maps || []).forEach((mapEntry) => {
      if (isMapEntryPlayed(mapEntry)) out.push(mapEntry)
    })
  })
  return out
}

/** Bilan par map, trié par nombre de manches jouées (les plus jouées d'abord). Compte chaque manche, pas chaque match. */
export function computeMapStats(matches, maps) {
  const mapByUuid = new Map(maps.map((m) => [m.uuid, m]))
  const byMap = new Map()

  playedMapEntries(matches).forEach((mapEntry) => {
    if (!mapEntry.mapUuid) return
    if (!byMap.has(mapEntry.mapUuid)) byMap.set(mapEntry.mapUuid, emptyRecord())
    addToRecord(byMap.get(mapEntry.mapUuid), mapEntryResult(mapEntry))
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
 * meilleure en premier, marquée isBest). Seules les manches avec une
 * composition assignée comptent ; chaque manche (pas chaque match)
 * est une contribution indépendante.
 */
export function computeCompositionStatsByMap(matches, compositionsByMap, maps) {
  const mapByUuid = new Map(maps.map((m) => [m.uuid, m]))
  const byMapThenComp = new Map()

  playedMapEntries(matches).forEach((mapEntry) => {
    if (!mapEntry.mapUuid || !mapEntry.compositionId) return
    const comp = Object.values(compositionsByMap[mapEntry.mapUuid] || {}).find((c) => c.id === mapEntry.compositionId)
    if (!comp) return

    if (!byMapThenComp.has(mapEntry.mapUuid)) byMapThenComp.set(mapEntry.mapUuid, new Map())
    const byComp = byMapThenComp.get(mapEntry.mapUuid)

    if (!byComp.has(comp.id)) {
      byComp.set(comp.id, { compositionId: comp.id, compositionName: comp.name, ...emptyRecord() })
    }
    addToRecord(byComp.get(comp.id), mapEntryResult(mapEntry))
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
