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
 * @param {boolean} [options.wait] Si vrai, récupère l'id du message
 *   Discord créé (nécessaire pour ensuite y ajouter des réactions de
 *   vote via addVoteReactions) — voir sendDiscordVoteMessage.
 */
export async function sendDiscordMessage(payload, { testUrl, wait } = {}) {
  try {
    const { data, error } = await supabase.functions.invoke('discord-notify', {
      body: { payload, testUrl, wait },
    })
    if (error) throw error
    return Boolean(data?.ok)
  } catch (err) {
    console.error('Envoi webhook Discord impossible :', err)
    return false
  }
}

/**
 * Variante de sendDiscordMessage utilisée pour un message "à voter"
 * (validation de compo, présence à un match) : renvoie l'id du message
 * et du salon (nécessaires pour y ajouter les réactions ✅/❌ ensuite),
 * ou `null` si l'envoi a échoué (webhook absent/invalide, Discord
 * injoignable…) — best effort, comme le reste des notifications.
 * @returns {Promise<{ messageId: string, channelId: string } | null>}
 */
export async function sendDiscordVoteMessage(payload) {
  try {
    const { data, error } = await supabase.functions.invoke('discord-notify', {
      body: { payload, wait: true },
    })
    if (error) throw error
    if (!data?.ok || !data?.message?.id || !data?.message?.channel_id) return null
    return { messageId: data.message.id, channelId: data.message.channel_id }
  } catch (err) {
    console.error('Envoi du message de vote Discord impossible :', err)
    return null
  }
}

/**
 * @param {object} params
 * @param {string} params.opponentName
 * @param {string} params.formatLabel Ex. "Bo1", "Bo3", "Bo5".
 * @param {string} params.seriesScore Score déjà formaté (ex. "13 – 8" en Bo1, "2 – 1" en Bo3/Bo5).
 * @param {'win'|'loss'|'draw'} params.result
 * @param {{ mapName: string, compositionName: string|null, ourScore: number, opponentScore: number }[]} params.maps
 *   Une entrée par manche jouée, dans l'ordre. Toujours au moins une entrée.
 *
 * Message structuré en champs (fields) plutôt qu'en une seule phrase :
 * chaque information (adversaire, format, score, détail des manches)
 * se lit d'un coup d'œil dans Discord au lieu d'être noyée dans une
 * description à rallonge.
 */
export function matchResultEmbed({ opponentName, formatLabel, seriesScore, result, maps }) {
  const draw = result === 'draw'
  const won = result === 'win'
  const title = draw ? '➖ Match nul' : won ? '🏆 Victoire !' : '💀 Défaite'
  const color = draw ? WARN_COLOR : won ? SUCCESS_COLOR : DANGER_COLOR

  const fields = [
    { name: 'Adversaire', value: opponentName, inline: true },
    { name: 'Format', value: formatLabel, inline: true },
    { name: 'Score de la série', value: `**${seriesScore}**`, inline: true },
  ]

  if (maps.length > 1) {
    fields.push({
      name: 'Manches',
      value: maps
        .map((m, i) => {
          const compLabel = m.compositionName ? ` · ${m.compositionName}` : ''
          return `Map ${i + 1} — **${m.mapName}**${compLabel} : ${m.ourScore} – ${m.opponentScore}`
        })
        .join('\n'),
    })
  } else if (maps[0]) {
    const compLabel = maps[0].compositionName ? ` (${maps[0].compositionName})` : ''
    fields.push({ name: 'Map', value: `${maps[0].mapName}${compLabel}`, inline: true })
  }

  return {
    embeds: [
      {
        title,
        color,
        fields,
        footer: { text: 'Comp Builder' },
        timestamp: new Date().toISOString(),
      },
    ],
  }
}

/**
 * @param {object} params
 * @param {string} params.opponentName
 * @param {string} params.formatLabel Ex. "Bo1", "Bo3", "Bo5".
 * @param {string} [params.matchDate] Date ISO (YYYY-MM-DD) ou vide si à définir.
 * @param {{ mapName: string }[]} params.maps Maps déjà choisies pour ce match (peut être vide).
 */
export function matchScheduledEmbed({ opponentName, formatLabel, matchDate, maps }) {
  const dateLabel = matchDate
    ? new Date(matchDate).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
    : 'à confirmer'

  const fields = [
    { name: 'Adversaire', value: opponentName, inline: true },
    { name: 'Format', value: formatLabel, inline: true },
    { name: 'Date', value: dateLabel, inline: true },
  ]

  if (maps.length > 0) {
    fields.push({ name: maps.length > 1 ? 'Maps' : 'Map', value: maps.map((m) => m.mapName).join(', ') })
  }

  // Les réactions ✅/❌ elles-mêmes sont ajoutées séparément une fois le
  // message envoyé (voir addVoteReactions) ; ce champ explique juste ce
  // qu'elles veulent dire une fois qu'elles apparaissent sur le message.
  fields.push({ name: 'Présence', value: 'Réagissez ✅ si vous êtes dispo, ❌ sinon.' })

  return {
    embeds: [
      {
        title: '📅 Match programmé',
        fields,
        color: BRAND_COLOR,
        footer: { text: 'Comp Builder' },
        timestamp: new Date().toISOString(),
      },
    ],
  }
}

/**
 * Message de lancement d'un vote de validation pour une composition.
 * Les réactions ✅/❌ sont ajoutées séparément (voir addVoteReactions
 * dans utils/discordBot.js) une fois ce message envoyé.
 * @param {object} params
 * @param {string} params.mapName
 * @param {string} params.compositionName
 */
export function compositionVoteEmbed({ mapName, compositionName }) {
  return {
    embeds: [
      {
        title: '🗳️ Vote — cette composition est-elle bonne ?',
        description: `Réagissez avec ✅ pour valider ou ❌ pour refuser **${compositionName}** sur **${mapName}**.`,
        fields: [
          { name: 'Map', value: mapName, inline: true },
          { name: 'Composition', value: compositionName, inline: true },
        ],
        color: WARN_COLOR,
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
