// ============================================================
// Reprise des données de l'ancien Comp Builder (ancien projet Supabase)
// dans le Comp Builder de l'équipe, sur la base du réseau.
//
// L'ancien projet laissait tout le monde LIRE ses tables (lecture
// publique) : il suffit de sa clé publique « anon » pour tout récupérer
// depuis le navigateur. Rien n'est modifié ni supprimé là-bas.
//
// Seules les compositions et l'effectif sont repris (matchs, dispos et
// Discord n'existent plus dans le Comp Builder du réseau).
//
// Les joueurs sont retrouvés par leur compte Discord : un ancien joueur
// qui est aussi membre de l'équipe sur le réseau récupère ses rôles et
// sa couleur ; les autres deviennent des fiches « hors réseau ».
// ============================================================

import { supabase } from './supabaseClient'
import { getTeamId } from './team'

export const LEGACY_URL = 'https://kkbgffyaaeixqprzcjmo.supabase.co'

async function legacyGet(url, key, table, query = 'select=*') {
  const res = await fetch(`${url}/rest/v1/${table}?${query}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  })
  if (res.status === 401 || res.status === 403) throw new Error('Clé refusée par l\'ancien projet. Vérifie que tu as copié la clé « anon public ».')
  if (!res.ok) throw new Error(`Lecture de « ${table} » impossible (${res.status}).`)
  return res.json()
}

async function insertAll(table, rows, { ignoreDuplicates = false, onConflict } = {}) {
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200)
    const q = ignoreDuplicates
      ? supabase.from(table).upsert(chunk, { onConflict, ignoreDuplicates: true })
      : supabase.from(table).insert(chunk)
    const { error } = await q
    if (error) throw new Error(`${table} : ${error.message}`)
  }
}

const clip = (s, n) => (s == null ? s : String(s).slice(0, n))
const COLOR = /^#[0-9a-fA-F]{6}$/

/**
 * @param {{ key: string, url?: string, onProgress?: (msg: string) => void }} params
 * @returns {Promise<{ players: number, compositions: number }>}
 */
export async function importLegacyData({ key, url = LEGACY_URL, onProgress = () => {} }) {
  const teamId = getTeamId()
  key = key.trim()
  if (!key) throw new Error('Colle la clé « anon public » de l\'ancien projet.')

  onProgress('Lecture de l\'ancien Comp Builder…')
  const [oldPlayers, oldComps] = await Promise.all([
    legacyGet(url, key, 'players'),
    legacyGet(url, key, 'compositions'),
  ])

  onProgress('Correspondance des joueurs…')
  const [{ data: members, error: e1 }, { data: fiches, error: e2 }] = await Promise.all([
    supabase.rpc('cb_member_discord_ids'),
    supabase.from('cb_players').select('id, user_id').eq('team_id', teamId),
  ])
  if (e1) throw e1
  if (e2) throw e2
  const userByDiscord = new Map((members || []).filter((m) => m.discord_id).map((m) => [m.discord_id, m.user_id]))
  const ficheByUser = new Map((fiches || []).filter((f) => f.user_id).map((f) => [f.user_id, f.id]))

  const playerMap = new Map()
  const newPlayers = []
  for (const p of oldPlayers) {
    const userId = p.discord_id ? userByDiscord.get(p.discord_id) : null
    const ficheId = userId ? ficheByUser.get(userId) : null
    const prefs = {
      primary_role: clip(p.primary_role, 20) || null,
      secondary_role: clip(p.secondary_role, 20) || null,
      color: COLOR.test(p.color || '') ? p.color : '#ff4655',
    }
    if (ficheId) {
      playerMap.set(p.id, ficheId)
      await supabase.from('cb_players').update(prefs).eq('id', ficheId)
    } else {
      const id = crypto.randomUUID()
      playerMap.set(p.id, id)
      newPlayers.push({ id, team_id: teamId, pseudo: clip(p.pseudo || 'Joueur', 32), ...prefs })
    }
  }
  await insertAll('cb_players', newPlayers)

  onProgress('Import des compositions…')
  const comps = oldComps.map((c) => {
    const id = crypto.randomUUID()
    const slots = Array.from({ length: 5 }, (_, i) => {
      const s = (Array.isArray(c.slots) && c.slots[i]) || {}
      return { agentUuid: s.agentUuid || null, playerId: (s.playerId && playerMap.get(s.playerId)) || null }
    })
    return {
      id,
      team_id: teamId,
      map_uuid: c.map_uuid,
      name: clip(c.name || 'Composition', 60),
      slots,
      status: ['todo', 'testing', 'needs_work', 'validated'].includes(c.status) ? c.status : 'todo',
      notes: clip(c.notes || '', 5000),
      is_main: Boolean(c.is_main),
      created_at: c.created_at,
      updated_at: c.updated_at,
    }
  })
  await insertAll('cb_compositions', comps)

  return { players: oldPlayers.length, compositions: comps.length }
}
