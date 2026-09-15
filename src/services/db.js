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
    // Vote Discord de validation — voteStatus vaut 'open' pendant que
    // le vote est en cours, null sinon (jamais lancé, ou déjà résolu).
    voteStatus: row.vote_status ?? null,
    voteMessageId: row.vote_message_id ?? null,
    voteChannelId: row.vote_channel_id ?? null,
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

/** Une manche (une map jouée) au sein d'un match — voir match_maps en base. */
function rowToMatchMap(row) {
  return {
    id: row.id,
    matchId: row.match_id,
    position: row.position,
    mapUuid: row.map_uuid,
    compositionId: row.composition_id,
    ourScore: row.our_score,
    opponentScore: row.opponent_score,
  }
}

function rowToMatch(row) {
  return {
    id: row.id,
    opponentName: row.opponent_name,
    format: row.format,
    matchDate: row.match_date,
    notes: row.notes,
    // Validation de présence (comptage global des réactions ✅/❌ sur le
    // message Discord envoyé à la programmation) — null tant qu'aucune
    // synchronisation n'a encore eu lieu.
    presenceMessageId: row.presence_message_id ?? null,
    presenceChannelId: row.presence_channel_id ?? null,
    presenceYes: row.presence_yes ?? null,
    presenceNo: row.presence_no ?? null,
    presenceSyncedAt: row.presence_synced_at ? new Date(row.presence_synced_at).getTime() : null,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
    // Présent seulement quand la ligne vient d'un select avec la
    // ressource imbriquée match_maps(*) — voir fetchMatches/
    // fetchMatchWithMaps. Trié par position (ordre des manches).
    maps: (row.match_maps || []).map(rowToMatchMap).sort((a, b) => a.position - b.position),
  }
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
  if ('voteStatus' in patch) dbPatch.vote_status = patch.voteStatus
  if ('voteMessageId' in patch) dbPatch.vote_message_id = patch.voteMessageId
  if ('voteChannelId' in patch) dbPatch.vote_channel_id = patch.voteChannelId

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

// ---------- Match Center ----------
//
// Un match est une série (format Bo1/Bo3/Bo5) ; ses manches (une par
// map jouée, chacune avec sa propre composition et son propre score)
// vivent dans match_maps, embarquées ici via la syntaxe PostgREST
// `match_maps(*)`. insertMatch/updateMatchRow acceptent un second
// paramètre `mapsDraft` (tableau de manches) — remplacé en bloc plutôt
// que diffé manche par manche, plus simple et le formulaire renvoie de
// toute façon l'état complet à chaque sauvegarde.

const MATCH_SELECT = '*, match_maps(*)'

export async function fetchMatches() {
  const { data, error } = await supabase
    .from('matches')
    .select(MATCH_SELECT)
    .order('position', { foreignTable: 'match_maps' })
  if (error) throw error
  return data.map(rowToMatch)
}

/** Recharge un match précis avec ses manches — utilisé après une
 * écriture (insert/update) et pour resynchroniser le temps réel. */
export async function fetchMatchWithMaps(id) {
  const { data, error } = await supabase
    .from('matches')
    .select(MATCH_SELECT)
    .eq('id', id)
    .order('position', { foreignTable: 'match_maps' })
    .single()
  if (error) throw error
  return rowToMatch(data)
}

/** Remplace toutes les manches d'un match par `mapsDraft` (delete + insert en bloc). */
async function replaceMatchMaps(matchId, mapsDraft) {
  const { error: delError } = await supabase.from('match_maps').delete().eq('match_id', matchId)
  if (delError) throw delError
  if (!mapsDraft || mapsDraft.length === 0) return

  const rows = mapsDraft.map((m, index) => ({
    match_id: matchId,
    position: index,
    map_uuid: m.mapUuid || null,
    composition_id: m.compositionId || null,
    our_score: m.ourScore === '' || m.ourScore === undefined ? null : m.ourScore,
    opponent_score: m.opponentScore === '' || m.opponentScore === undefined ? null : m.opponentScore,
  }))
  const { error } = await supabase.from('match_maps').insert(rows)
  if (error) throw error
}

export async function insertMatch(draft, mapsDraft = []) {
  const { data, error } = await supabase
    .from('matches')
    .insert({
      opponent_name: draft.opponentName,
      format: draft.format || 'bo1',
      match_date: draft.matchDate || null,
      notes: draft.notes || '',
    })
    .select()
    .single()
  if (error) throw error
  await replaceMatchMaps(data.id, mapsDraft)
  return fetchMatchWithMaps(data.id)
}

export async function updateMatchRow(id, patch, mapsDraft) {
  const dbPatch = { updated_at: new Date().toISOString() }
  if ('opponentName' in patch) dbPatch.opponent_name = patch.opponentName
  if ('format' in patch) dbPatch.format = patch.format
  if ('matchDate' in patch) dbPatch.match_date = patch.matchDate
  if ('notes' in patch) dbPatch.notes = patch.notes
  if ('presenceMessageId' in patch) dbPatch.presence_message_id = patch.presenceMessageId
  if ('presenceChannelId' in patch) dbPatch.presence_channel_id = patch.presenceChannelId
  if ('presenceYes' in patch) dbPatch.presence_yes = patch.presenceYes
  if ('presenceNo' in patch) dbPatch.presence_no = patch.presenceNo
  if ('presenceSyncedAt' in patch) dbPatch.presence_synced_at = patch.presenceSyncedAt

  const { error } = await supabase.from('matches').update(dbPatch).eq('id', id)
  if (error) throw error
  // mapsDraft absent (undefined) = les manches ne changent pas pour cet
  // appel (ex. un simple renommage) ; un tableau, même vide, remplace.
  if (mapsDraft !== undefined) await replaceMatchMaps(id, mapsDraft)
  return fetchMatchWithMaps(id)
}

export async function deleteMatchRow(id) {
  // match_maps se supprime en cascade (on delete cascade en base).
  const { error } = await supabase.from('matches').delete().eq('id', id)
  if (error) throw error
}

// ---------- Réglages d'équipe (webhook Discord) ----------
// Table à une seule ligne (id = true). Lecture/écriture réservées aux
// admins par les policies RLS : un visiteur non-admin reçoit ici une
// ligne vide (rejetée par RLS), pas une erreur.

function rowToTeamSettings(row) {
  return { discordWebhookUrl: row?.discord_webhook_url || '' }
}

export async function fetchTeamSettings() {
  const { data, error } = await supabase
    .from('team_settings')
    .select('discord_webhook_url')
    .eq('id', true)
    .maybeSingle()
  if (error) throw error
  return rowToTeamSettings(data)
}

export async function updateTeamSettingsRow(patch) {
  const dbPatch = {}
  if ('discordWebhookUrl' in patch) dbPatch.discord_webhook_url = patch.discordWebhookUrl || null

  const { data, error } = await supabase
    .from('team_settings')
    .update(dbPatch)
    .eq('id', true)
    .select('discord_webhook_url')
    .single()
  if (error) throw error
  return rowToTeamSettings(data)
}

export { rowToComposition, rowToPlayer, rowToMatch, rowToMatchMap }
