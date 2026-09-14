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
  TODO: 'todo',
}

// Système de statut simplifié : 4 étapes toujours, mais des libellés
// plus parlants (une "Brouillon" n'a pas encore été essayée, une compo
// "À revoir" l'a été et n'a pas convaincu — deux cas différents qu'il
// serait dommage de fusionner) et des couleurs qui reprennent les
// tokens de rôle déjà utilisés partout ailleurs (--role-sentinel/
// initiator/duelist/flex) plutôt que des hex codés en dur : un seul
// jeu de teintes sémantiques pour toute l'app (statuts, résultats de
// match, rôles des joueurs), qui suit automatiquement la palette si
// elle change un jour. C'est aussi ce qui corrige un oubli de la
// dernière refonte graphique : le gris de "À faire" était resté un
// gris froid (#c7cdd6) alors que tout le reste de l'app était passé à
// une palette chaude.
export const STATUS_META = {
  [STATUS.VALIDATED]: { label: 'Prête', emoji: '🟢', color: 'var(--role-sentinel)' },
  [STATUS.TESTING]: { label: 'En test', emoji: '🟡', color: 'var(--role-initiator)' },
  [STATUS.NEEDS_WORK]: { label: 'À revoir', emoji: '🔴', color: 'var(--role-duelist)' },
  [STATUS.TODO]: { label: 'Brouillon', emoji: '⚪', color: 'var(--role-flex)' },
}

/**
 * Rôle "joueur polyvalent", en plus des 4 rôles d'agents fournis par
 * l'API Valorant. Couleur reprise de la palette joueur existante
 * (PLAYER_COLORS) pour rester cohérente avec le reste de l'interface.
 */
export const FLEX_ROLE = { name: 'Flex', icon: null }
export const FLEX_ROLE_COLOR = 'var(--role-flex)'

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
