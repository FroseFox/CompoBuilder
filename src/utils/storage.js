// ============================================================
// Constantes et formes de données partagées par l'application.
//
// Depuis la migration vers Supabase, ce fichier ne contient plus
// de logique de lecture/écriture (voir src/services/db.js) : il ne
// garde que les constantes (clés de thème, statuts, couleurs) et les
// fabriques d'objets par défaut (composition vide, joueur), utiles
// aussi bien côté contexte que côté formulaires.
// ============================================================

export const THEME_KEY = 'vct-comp-builder:theme'

export const STATUS = {
  VALIDATED: 'validated',
  TESTING: 'testing',
  NEEDS_WORK: 'needs_work',
}

export const STATUS_META = {
  [STATUS.VALIDATED]: { label: 'Validée', emoji: '🟢', color: '#3ddc97' },
  [STATUS.TESTING]: { label: 'En test', emoji: '🟡', color: '#ffb54c' },
  [STATUS.NEEDS_WORK]: { label: 'À retravailler', emoji: '🔴', color: '#ff5f6d' },
}

export const PLAYER_COLORS = [
  '#ff4655', '#ff8a4c', '#ffc94c', '#8ce971',
  '#3ddc97', '#4cd4d9', '#7c8cff', '#c67cff',
  '#ff7cc5', '#c7cdd6',
]

export const emptySlots = () =>
  Array.from({ length: 5 }, () => ({ agentUuid: null, playerId: null }))

/** Forme par défaut d'une nouvelle composition (avant insertion en base). */
export function defaultCompositionDraft(name, { isMain = false } = {}) {
  return {
    name: name || 'Nouvelle composition',
    slots: emptySlots(),
    status: STATUS.TESTING,
    notes: '',
    isMain,
  }
}
