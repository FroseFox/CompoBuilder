// ============================================================
// Génère une image PNG partageable (carte "annonce de match") pour un
// match programmé, dessinée sur un <canvas> hors-DOM — même identité
// visuelle que la carte de composition (voir exportComposition.js :
// fond sombre, accent rouge, branding "COMP BUILDER").
//
// Remplace le message texte Discord habituel envoyé à la programmation
// d'un match : Format (Bo1/Bo3/Bo5), Map(s), Date et Heure sont donc
// tous dessinés sur l'image, ainsi que l'instruction de présence
// ("réagissez ✅/❌"), puisque ce message ne s'accompagne d'aucun texte
// Discord (voir sendDiscordVoteImage dans discordWebhook.js).
// ============================================================

import { roundRect, hexWithAlpha, slugify } from './exportComposition'

const FORMAT_LABELS = {
  bo1: 'BO1',
  bo3: 'BO3',
  bo5: 'BO5',
}

/**
 * @param {object} params
 * @param {string} params.opponentName
 * @param {'bo1'|'bo3'|'bo5'|string} [params.formatLabel] Clé de format (voir MATCH_FORMAT) ou libellé déjà formaté.
 * @param {string[]} [params.mapNames] Une ou plusieurs maps déjà choisies (peut être vide : "à définir").
 * @param {string} [params.matchDate] Date ISO (YYYY-MM-DD), ou vide si à définir.
 * @param {string} [params.matchTime] Heure au format "HH:MM" (valeur d'un <input type="time">), optionnelle.
 * @returns {Promise<Blob>} PNG
 */
export async function renderMatchCard({ opponentName, formatLabel, mapNames = [], matchDate, matchTime }) {
  const SCALE = 2
  const W = 900
  const H = 480

  const canvas = document.createElement('canvas')
  canvas.width = W * SCALE
  canvas.height = H * SCALE
  const ctx = canvas.getContext('2d')
  ctx.scale(SCALE, SCALE)

  // ---------- Fond ----------
  ctx.fillStyle = '#0b1119'
  ctx.fillRect(0, 0, W, H)
  const glow = ctx.createRadialGradient(W / 2, 0, 0, W / 2, 0, 480)
  glow.addColorStop(0, 'rgba(255,70,85,0.16)')
  glow.addColorStop(1, 'rgba(255,70,85,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, 260)

  // ---------- En-tête ----------
  ctx.fillStyle = '#ff4655'
  ctx.font = '700 13px Arial'
  ctx.fillText('— COMP BUILDER · MATCH PROGRAMMÉ', 40, 42)

  ctx.fillStyle = '#ece8e1'
  ctx.font = '700 38px Arial'
  ctx.fillText(`VS ${opponentName || 'Adversaire'}`, 40, 90)

  // Pastille de format (BO1/BO3/BO5), en haut à droite
  const formatKey = String(formatLabel || '').toLowerCase()
  const formatText = FORMAT_LABELS[formatKey] || (formatLabel ? String(formatLabel).toUpperCase() : 'BO1')
  const formatColor = '#7c8cff'
  ctx.font = '700 14px Arial'
  const formatWidth = ctx.measureText(formatText).width
  const pillH = 34
  const pillW = formatWidth + 50
  const pillX = W - 40 - pillW
  const pillY = 40
  roundRect(ctx, pillX, pillY, pillW, pillH, pillH / 2)
  ctx.fillStyle = hexWithAlpha(formatColor, 0.16)
  ctx.fill()
  ctx.strokeStyle = formatColor
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.fillStyle = formatColor
  ctx.textAlign = 'center'
  ctx.fillText(formatText, pillX + pillW / 2, pillY + pillH / 2 + 5)
  ctx.textAlign = 'left'

  ctx.strokeStyle = 'rgba(255,255,255,0.08)'
  ctx.beginPath()
  ctx.moveTo(40, 140)
  ctx.lineTo(W - 40, 140)
  ctx.stroke()

  // ---------- Date / Heure ----------
  const dateLabel = matchDate
    ? new Date(matchDate).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
    : 'À définir'
  const timeLabel = matchTime ? matchTime.replace(':', 'h') : 'À définir'

  const infoY = 170
  const infoBoxH = 76
  const infoGap = 20
  const infoBoxW = (W - 80 - infoGap) / 2
  const drawInfoBox = (x, label, value) => {
    roundRect(ctx, x, infoY, infoBoxW, infoBoxH, 12)
    ctx.fillStyle = '#141e29'
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.fillStyle = '#5c6a76'
    ctx.font = '700 11px Arial'
    ctx.fillText(label.toUpperCase(), x + 22, infoY + 28)
    ctx.fillStyle = '#ece8e1'
    ctx.font = '700 20px Arial'
    ctx.fillText(value, x + 22, infoY + 56)
  }
  drawInfoBox(40, 'Date', dateLabel)
  drawInfoBox(40 + infoBoxW + infoGap, 'Heure', timeLabel)

  // ---------- Map(s) ----------
  const mapsY = infoY + infoBoxH + 30
  ctx.fillStyle = '#97a3ad'
  ctx.font = '700 12px Arial'
  ctx.fillText(mapNames.length > 1 ? 'MAPS' : 'MAP', 40, mapsY)

  const chipY = mapsY + 14
  const chipH = 36
  const names = mapNames.length ? mapNames : ['À définir']
  ctx.font = '600 15px Arial'
  let chipX = 40
  let chipRowY = chipY
  names.forEach((name) => {
    const textW = ctx.measureText(name).width
    const chipW = textW + 36
    // Retour à la ligne si la carte de maps déborderait (Bo5 avec des
    // noms de maps longs) — improbable avec les maps Valorant actuelles
    // mais évite un débordement silencieux si la liste de maps s'allonge.
    if (chipX + chipW > W - 40 && chipX > 40) {
      chipX = 40
      chipRowY += chipH + 10
    }
    roundRect(ctx, chipX, chipRowY, chipW, chipH, chipH / 2)
    ctx.fillStyle = 'rgba(255,255,255,0.06)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.fillStyle = '#ece8e1'
    ctx.fillText(name, chipX + 18, chipRowY + chipH / 2 + 5)
    chipX += chipW + 12
  })

  // ---------- Bannière de présence ----------
  // Aucun texte Discord n'accompagne cette image : l'instruction de vote
  // de présence doit donc être lisible directement dessus.
  const bannerY = H - 96
  const bannerH = 40
  const presenceColor = '#3ddc97'
  roundRect(ctx, 40, bannerY, W - 80, bannerH, 10)
  ctx.fillStyle = hexWithAlpha(presenceColor, 0.14)
  ctx.fill()
  ctx.strokeStyle = presenceColor
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.fillStyle = presenceColor
  ctx.font = '700 15px Arial'
  ctx.textAlign = 'center'
  ctx.fillText('✅ Présent · ❌ Absent — réagissez sur ce message pour confirmer', W / 2, bannerY + bannerH / 2 + 5)
  ctx.textAlign = 'left'

  // ---------- Footer ----------
  ctx.textAlign = 'right'
  ctx.fillStyle = '#5c6a76'
  ctx.font = '500 11px Arial'
  const generatedStr = new Date().toLocaleDateString('fr-FR')
  ctx.fillText(`Match annoncé le ${generatedStr} · frosefox.github.io/CompoBuilder`, W - 40, H - 26)
  ctx.textAlign = 'left'

  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
}

export function matchCardFileName(opponentName) {
  return `match-${slugify(opponentName || 'adversaire')}.png`
}
