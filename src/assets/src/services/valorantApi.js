// ============================================================
// Service API — valorant-api.com
// API publique, gratuite, sans clé, communément utilisée pour
// des projets scolaires/personnels autour de Valorant.
// Toutes les données (maps, agents, rôles, images) sont
// récupérées dynamiquement : aucune donnée codée en dur ici.
// ============================================================

const BASE_URL = 'https://valorant-api.com/v1'
const LANG = 'fr-FR'

class ValorantApiError extends Error {
  constructor(message, cause) {
    super(message)
    this.name = 'ValorantApiError'
    this.cause = cause
  }
}

async function request(path) {
  let response
  try {
    response = await fetch(`${BASE_URL}${path}`)
  } catch (err) {
    throw new ValorantApiError(
      "Impossible de contacter l'API Valorant. Vérifiez votre connexion internet.",
      err
    )
  }

  if (!response.ok) {
    throw new ValorantApiError(
      `L'API Valorant a répondu avec une erreur (${response.status}).`
    )
  }

  const json = await response.json()

  if (json.status !== 200 || !json.data) {
    throw new ValorantApiError("Réponse inattendue de l'API Valorant.")
  }

  return json.data
}

/**
 * Récupère toutes les maps jouables en compétitif.
 * On filtre les entrées techniques (range d'entraînement, etc.)
 * en s'appuyant sur le champ `coordinates`, absent pour ces
 * pseudo-maps dans l'API — pas de liste codée en dur.
 */
export async function fetchMaps() {
  const data = await request(`/maps?language=${LANG}`)
  return data
    .filter((map) => Boolean(map.coordinates) && Boolean(map.displayName))
    .map((map) => ({
      uuid: map.uuid,
      name: map.displayName,
      image: map.splash || map.listViewIcon,
      thumbnail: map.listViewIcon || map.splash,
      minimap: map.displayIcon,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Récupère tous les agents jouables, avec leur rôle et portraits.
 */
export async function fetchAgents() {
  const data = await request(
    `/agents?isPlayableCharacter=true&language=${LANG}`
  )
  return data
    .filter((agent) => Boolean(agent.role) && Boolean(agent.displayName))
    .map((agent) => ({
      uuid: agent.uuid,
      name: agent.displayName,
      portrait: agent.fullPortrait || agent.displayIcon,
      icon: agent.displayIcon,
      role: {
        name: agent.role.displayName,
        icon: agent.role.displayIcon,
      },
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export { ValorantApiError }
