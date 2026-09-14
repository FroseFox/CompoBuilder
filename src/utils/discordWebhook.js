// ============================================================
// Envoi de notifications à un webhook Discord.
//
// Un fetch() direct depuis le navigateur vers discord.com échoue : les
// webhooks Discord ne renvoient pas d'en-têtes CORS permissifs pour une
// requête JSON envoyée depuis un site tiers, donc le navigateur bloque
// l'appel avant même qu'il parte. On passe donc par une Edge Function
// Supabase (supabase/functions/discord-notify), qui fait l'appel
// serveur → serveur (non soumis à CORS) et vérifie côté serveur que
// l'appelant est bien un admin avant d'envoyer quoi que ce soit.
//
// Toujours "best effort" : un échec (webhook non configuré, Discord
// injoignable…) est simplement journalisé en console et ne doit jamais
// faire échouer l'action principale de l'utilisateur (ajouter un match,
// valider une composition).
// ============================================================

import { supabase } from '../services/supabaseClient'

const BRAND_COLOR = 0xff4655
const SUCCESS_COLOR = 0x3ddc97
const WARN_COLOR = 0xffb54c
const DANGER_COLOR = 0xff5f6d

/**
 * @param {object} payload Corps du message Discord (voir les fabriques
 *   *Embed ci-dessous).
 * @param {object} [options]
 * @param {string} [options.testUrl] URL de webhook non encore
 *   enregistrée, utilisée uniquement par le bouton "Tester" du panneau
 *   de réglages (avant sauvegarde).
 */
export async function sendDiscordMessage(payload, { testUrl } = {}) {
  try {
    const { data, error } = await supabase.functions.invoke('discord-notify', {
      body: { payload, testUrl },
    })
    if (error) throw error
    return Boolean(data?.ok)
  } catch (err) {
    console.error('Envoi webhook Discord impossible :', err)
    return false
  }
}

export function matchResultEmbed({ opponentName, ourScore, opponentScore, mapName }) {
  const won = ourScore > opponentScore
  const draw = ourScore === opponentScore
  const title = draw ? '➖ Match nul' : won ? '🏆 Victoire !' : '💀 Défaite'
  const color = draw ? WARN_COLOR : won ? SUCCESS_COLOR : DANGER_COLOR

  return {
    embeds: [
      {
        title,
        description: `**${ourScore} – ${opponentScore}** contre **${opponentName}**${mapName ? ` sur ${mapName}` : ''}`,
        color,
        footer: { text: 'Comp Builder' },
        timestamp: new Date().toISOString(),
      },
    ],
  }
}

export function matchScheduledEmbed({ opponentName, matchDate, mapName }) {
  const dateLabel = matchDate
    ? new Date(matchDate).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
    : 'date à confirmer'

  return {
    embeds: [
      {
        title: '📅 Match programmé',
        description: `Contre **${opponentName}**${mapName ? ` sur ${mapName}` : ''} — ${dateLabel}.`,
        color: BRAND_COLOR,
        footer: { text: 'Comp Builder' },
        timestamp: new Date().toISOString(),
      },
    ],
  }
}

export function compositionValidatedEmbed({ mapName, compositionName }) {
  return {
    embeds: [
      {
        title: '✅ Composition validée',
        description: `**${compositionName}** sur **${mapName}** est prête à être jouée.`,
        color: BRAND_COLOR,
        footer: { text: 'Comp Builder' },
        timestamp: new Date().toISOString(),
      },
    ],
  }
}

export function testMessageEmbed() {
  return {
    embeds: [
      {
        title: '🔔 Test de connexion',
        description: 'Si vous voyez ce message, le webhook Comp Builder est bien configuré.',
        color: BRAND_COLOR,
        footer: { text: 'Comp Builder' },
        timestamp: new Date().toISOString(),
      },
    ],
  }
}
