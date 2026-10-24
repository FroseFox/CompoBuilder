// ============================================================
// Équipe courante + liens avec le site du réseau PRIZM.
//
// Le Comp Builder vit maintenant DANS le site du PRIZM Competitive
// Network (dossier /compo/), sur la même base Supabase. Chaque équipe
// inscrite sur le réseau a son propre Comp Builder : toutes les
// requêtes sont limitées à l'équipe de la personne connectée (et la
// base le vérifie aussi, via les règles RLS).
// ============================================================

// Adresse publique du site du réseau (utilisée seulement si le Comp
// Builder est ouvert depuis une autre adresse, ex. l'ancien lien).
export const NETWORK_PUBLIC_URL = 'https://prizmesportcontact-arch.github.io/PRIZM---Competitive-Network/'

/** Racine du site du réseau : le dossier parent quand on est dans /compo/. */
export function networkUrl(hash = '') {
  const inNetwork = /\/compo\/?$/.test(window.location.pathname) || window.location.pathname.includes('/compo/')
  const base = inNetwork ? new URL('../', window.location.href).href : NETWORK_PUBLIC_URL
  return base + hash
}

let currentTeamId = null

export function setTeamScope(teamId) {
  currentTeamId = teamId || null
}

export function getTeamId() {
  if (!currentTeamId) throw new Error('Aucune équipe sélectionnée.')
  return currentTeamId
}

/** Filtre temps réel : seulement les lignes de mon équipe. */
export function teamFilter() {
  return `team_id=eq.${getTeamId()}`
}
