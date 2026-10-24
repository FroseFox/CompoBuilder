// ============================================================
// Couche d'accès aux données Supabase.
//
// Isole toutes les requêtes SQL/PostgREST dans un seul endroit, et
// convertit entre le format des lignes en base (snake_case) et le
// format utilisé par le reste de l'application (camelCase), pour que
// les contextes React n'aient jamais à connaître les noms de colonnes.
// ============================================================

import { supabase } from './supabaseClient'
import { getTeamId } from './team'

// ---------- Mappers ----------

function rowToComposition(row) {
  return {
    id: row.id,
    mapUuid: row.map_uuid,
    name: row.name,
    slots: row.slots,
    status: row.status,
    notes: row.notes,
    isMain: row.is_main,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  }
}

function rowToPlayer(row) {
  return {
    id: row.id,
    pseudo: row.pseudo,
    primaryRole: row.primary_role,
    secondaryRole: row.secondary_role,
    color: row.color,
    // Compte connecté (voir public.claim_player / connexion Discord) —
    // null pour une fiche créée manuellement, jamais reliée à un compte.
    userId: row.user_id ?? null,
    // Fiche reliée à un membre de l'équipe sur le réseau (connexion
    // Discord) : sert au badge Discord et à savoir si la fiche peut être
    // supprimée ici (non : on retire un membre depuis « Mon équipe »).
    discordId: row.user_id ?? null,
    createdAt: new Date(row.created_at).getTime(),
  }
}

// ---------- Players ----------

export async function fetchPlayers() {
  const { data, error } = await supabase.from('cb_players').select('*').eq('team_id', getTeamId())
  if (error) throw error
  return data.map(rowToPlayer)
}

export async function insertPlayer({ pseudo, primaryRole, secondaryRole, color }) {
  const { data, error } = await supabase
    .from('cb_players')
    .insert({ team_id: getTeamId(), pseudo, primary_role: primaryRole, secondary_role: secondaryRole, color })
    .select()
    .single()
  if (error) throw error
  return rowToPlayer(data)
}

export async function updatePlayerRow(id, { pseudo, primaryRole, secondaryRole, color }) {
  const { data, error } = await supabase
    .from('cb_players')
    .update({ pseudo, primary_role: primaryRole, secondary_role: secondaryRole, color })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return rowToPlayer(data)
}

export async function deletePlayerRow(id) {
  const { error } = await supabase.from('cb_players').delete().eq('id', id)
  if (error) throw error
}

/**
 * Donne (ou retire) à un membre le droit de modifier le Comp Builder de
 * l'équipe. Réservé au capitaine (vérifié par la base, cb_set_editor).
 */
export async function setPlayerAdminRow(userId, makeAdmin) {
  const { error } = await supabase.rpc('cb_set_editor', { p_user: userId, p_on: makeAdmin })
  if (error) throw error
}

/**
 * Qui peut modifier : le capitaine + les membres « éditeurs ».
 * Renvoie { captainId, editorUserIds: Set<userId> }.
 */
export async function fetchTeamAccess() {
  const teamId = getTeamId()
  const [{ data: team, error: e1 }, { data: members, error: e2 }] = await Promise.all([
    supabase.from('teams').select('captain_id').eq('id', teamId).maybeSingle(),
    supabase.from('team_members').select('user_id, cb_editor').eq('team_id', teamId),
  ])
  if (e1) throw e1
  if (e2) throw e2
  const editorUserIds = new Set((members || []).filter((m) => m.cb_editor).map((m) => m.user_id))
  if (team?.captain_id) editorUserIds.add(team.captain_id)
  return { captainId: team?.captain_id || null, editorUserIds }
}

// ---------- Compositions ----------

export async function fetchCompositions() {
  const { data, error } = await supabase.from('cb_compositions').select('*').eq('team_id', getTeamId())
  if (error) throw error
  return data.map(rowToComposition)
}

export async function insertComposition(mapUuid, draft) {
  const { data, error } = await supabase
    .from('cb_compositions')
    .insert({
      team_id: getTeamId(),
      map_uuid: mapUuid,
      name: draft.name,
      slots: draft.slots,
      status: draft.status,
      notes: draft.notes,
      is_main: draft.isMain,
    })
    .select()
    .single()
  if (error) throw error
  return rowToComposition(data)
}

export async function updateCompositionRow(id, patch) {
  const dbPatch = { updated_at: new Date().toISOString() }
  if ('name' in patch) dbPatch.name = patch.name
  if ('slots' in patch) dbPatch.slots = patch.slots
  if ('status' in patch) dbPatch.status = patch.status
  if ('notes' in patch) dbPatch.notes = patch.notes
  if ('isMain' in patch) dbPatch.is_main = patch.isMain

  const { data, error } = await supabase
    .from('cb_compositions')
    .update(dbPatch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return rowToComposition(data)
}

export async function deleteCompositionRow(id) {
  const { error } = await supabase.from('cb_compositions').delete().eq('id', id)
  if (error) throw error
}

/** Supprime toutes les compositions (bouton "Réinitialiser tout", admin uniquement). */
export async function deleteAllCompositions() {
  const { error } = await supabase.from('cb_compositions').delete().eq('team_id', getTeamId())
  if (error) throw error
}

export { rowToComposition, rowToPlayer }
