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

// La fonction discord-bot répond toujours avec un corps JSON { error }
// explicite (bot non configuré, Discord a refusé la requête, etc.),
// mais supabase.functions.invoke() rejette dès qu'un statut non-2xx est
// reçu et remplace ce corps par une FunctionsHttpError générique dont
// le .message ne contient PAS le texte utile — celui-ci reste dans la
// réponse HTTP portée par `error.context`. Sans ça, seul un
// console.error (invisible pour quelqu'un qui n'ouvre pas les outils
// dev du navigateur) donnait un indice, d'où le "ça ne marche pas,
// sans plus de détails" côté utilisateur : on extrait donc ce message
// pour pouvoir l'afficher directement dans l'app (toast).
async function extractFunctionError(err) {
  const fallback = err?.message || 'Erreur inconnue.'
  try {
    if (err?.context?.json) return (await err.context.json())?.error || fallback
    if (err?.context?.text) return (await err.context.text()) || fallback
  } catch {
    // Le corps n'a pas pu être relu (déjà consommé, etc.) — on garde le fallback.
  }
  return fallback
}

/**
 * Ajoute les deux réactions ✅/❌ à un message déjà envoyé (voir
 * sendDiscordVoteMessage dans discordWebhook.js pour l'obtenir).
 * @returns {Promise<{ ok: boolean, error: string|null }>}
 */
export async function addVoteReactions({ channelId, messageId }) {
  try {
    const { data, error } = await supabase.functions.invoke('discord-bot', {
      body: { action: 'addReactions', channelId, messageId },
    })
    if (error) throw error
    return { ok: Boolean(data?.ok), error: data?.ok ? null : data?.error || null }
  } catch (err) {
    const message = await extractFunctionError(err)
    console.error("Impossible d'ajouter les réactions de vote Discord :", message)
    return { ok: false, error: message }
  }
}

/**
 * Compte les votants ✅/❌ sur un message (hors réaction du bot lui-même).
 * @returns {Promise<{ counts: { yes: number, no: number }|null, error: string|null }>}
 */
export async function getVoteCounts({ channelId, messageId }) {
  try {
    const { data, error } = await supabase.functions.invoke('discord-bot', {
      body: { action: 'getReactionCounts', channelId, messageId },
    })
    if (error) throw error
    if (!data?.ok || !data?.counts) return { counts: null, error: data?.error || 'Réponse inattendue du bot Discord.' }
    return { counts: data.counts, error: null }
  } catch (err) {
    const message = await extractFunctionError(err)
    console.error('Impossible de compter les votes Discord :', message)
    return { counts: null, error: message }
  }
}
