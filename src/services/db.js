// ============================================================
// Couche d'accès aux données Supabase.
//
// Isole toutes les requêtes SQL/PostgREST dans un seul endroit, et
// convertit entre le format des lignes en base (snake_case) et le
// format utilisé par le reste de l'application (camelCase), pour que
// les contextes React n'aient jamais à connaître les noms de colonnes.
// ============================================================

import { supabase } from './supabaseClient'

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
    createdAt: new Date(row.created_at).getTime(),
  }
}

// ---------- Maps & agents (données de référence, synchronisées depuis valorant-api.com) ----------

export async function fetchMapsTable() {
  const { data, error } = await supabase.from('maps').select('uuid, name')
  if (error) throw error
  return data
}

export async function upsertMaps(maps) {
  const rows = maps.map((m) => ({ uuid: m.uuid, name: m.name }))
  const { error } = await supabase.from('maps').upsert(rows, { onConflict: 'uuid' })
  if (error) throw error
}

export async function upsertAgents(agents) {
  const rows = agents.map((a) => ({ uuid: a.uuid, name: a.name, role: a.role.name }))
  const { error } = await supabase.from('agents').upsert(rows, { onConflict: 'uuid' })
  if (error) throw error
}

// ---------- Players ----------

export async function fetchPlayers() {
  const { data, error } = await supabase.from('players').select('*')
  if (error) throw error
  return data.map(rowToPlayer)
}

export async function insertPlayer({ pseudo, primaryRole, secondaryRole, color }) {
  const { data, error } = await supabase
    .from('players')
    .insert({ pseudo, primary_role: primaryRole, secondary_role: secondaryRole, color })
    .select()
    .single()
  if (error) throw error
  return rowToPlayer(data)
}

export async function updatePlayerRow(id, { pseudo, primaryRole, secondaryRole, color }) {
  const { data, error } = await supabase
    .from('players')
    .update({ pseudo, primary_role: primaryRole, secondary_role: secondaryRole, color })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return rowToPlayer(data)
}

export async function deletePlayerRow(id) {
  const { error } = await supabase.from('players').delete().eq('id', id)
  if (error) throw error
}

// ---------- Compositions ----------

export async function fetchCompositions() {
  const { data, error } = await supabase.from('compositions').select('*')
  if (error) throw error
  return data.map(rowToComposition)
}

export async function insertComposition(mapUuid, draft) {
  const { data, error } = await supabase
    .from('compositions')
    .insert({
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
    .from('compositions')
    .update(dbPatch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return rowToComposition(data)
}

export async function deleteCompositionRow(id) {
  const { error } = await supabase.from('compositions').delete().eq('id', id)
  if (error) throw error
}

/** Supprime toutes les compositions (bouton "Réinitialiser tout", admin uniquement). */
export async function deleteAllCompositions() {
  // neq sur une colonne toujours vraie : supprime toutes les lignes.
  const { error } = await supabase.from('compositions').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  if (error) throw error
}

export { rowToComposition, rowToPlayer }
