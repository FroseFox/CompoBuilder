// ============================================================
// Envoi de notifications à un webhook Discord, directement depuis le
// navigateur (les webhooks Discord acceptent les requêtes cross-origin,
// donc pas besoin d'un serveur intermédiaire pour ce petit outil
// d'équipe).
//
// Toujours "best effort" : un échec (URL invalide, Discord injoignable,
// webhook supprimé…) est simplement journalisé en console et ne doit
// jamais faire échouer l'action principale de l'utilisateur (ajouter un
// match, valider une composition).
// ============================================================

const BRAND_COLOR = 0xff4655
const SUCCESS_COLOR = 0x3ddc97
const WARN_COLOR = 0xffb54c
const DANGER_COLOR = 0xff5f6d

export async function sendDiscordMessage(webhookUrl, payload) {
  if (!webhookUrl) return false
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    return res.ok
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
