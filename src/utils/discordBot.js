// ============================================================
// Actions Discord qui passent par le BOT plutôt que par le webhook
// (voir supabase/functions/discord-bot) : ajouter les réactions ✅/❌
// à un message de vote, puis compter qui a réagi.
//
// Toujours "best effort" côté appelant : un échec ici (bot non
// configuré, permissions manquantes sur le salon…) ne doit jamais
// empêcher l'action principale (le message lui-même a déjà été
// envoyé via le webhook) — mais contrairement aux notifications
// simples, l'appelant a ici besoin de savoir si ça a marché, pour
// informer l'admin (ex. "vote lancé, mais impossible de compter").
// ============================================================

import { supabase } from '../services/supabaseClient'

/**
 * Ajoute les deux réactions ✅/❌ à un message déjà envoyé (voir
 * sendDiscordVoteMessage dans discordWebhook.js pour l'obtenir).
 * @returns {Promise<boolean>} succès
 */
export async function addVoteReactions({ channelId, messageId }) {
  try {
    const { data, error } = await supabase.functions.invoke('discord-bot', {
      body: { action: 'addReactions', channelId, messageId },
    })
    if (error) throw error
    return Boolean(data?.ok)
  } catch (err) {
    console.error("Impossible d'ajouter les réactions de vote Discord :", err)
    return false
  }
}

/**
 * Compte les votants ✅/❌ sur un message (hors réaction du bot lui-même).
 * @returns {Promise<{ yes: number, no: number } | null>} null si le
 *   comptage a échoué (bot non configuré, message supprimé…).
 */
export async function getVoteCounts({ channelId, messageId }) {
  try {
    const { data, error } = await supabase.functions.invoke('discord-bot', {
      body: { action: 'getReactionCounts', channelId, messageId },
    })
    if (error) throw error
    if (!data?.ok || !data?.counts) return null
    return data.counts
  } catch (err) {
    console.error('Impossible de compter les votes Discord :', err)
    return null
  }
}
