// ============================================================
// Génère une image PNG partageable (carte "annonce de match") pour un
// match programmé, dessinée sur un <canvas> hors-DOM — même identité
// visuelle que la carte de composition (voir exportComposition.js :
// fond sombre, accent rouge, coins coupés, polices Barlow Condensed /
// Inter, branding "COMP BUILDER").
//
// Remplace le message texte Discord habituel envoyé à la programmation
// d'un match : Format (Bo1/Bo3/Bo5), Map(s), Date et Heure sont donc
// tous dessinés sur l'image, ainsi que l'instruction de présence
// ("réagissez ✅/❌"), puisque ce message ne s'accompagne d'aucun texte
// Discord (voir sendDiscordVoteImage dans discordWebhook.js).
// ============================================================

import { cutCornerRect, hexWithAlpha, slugify, ensureFontsReady, loadImage, drawImageCover } from './exportComposition'

const FORMAT_LABELS = {
  bo1: 'BO1',
  bo3: 'BO3',
  bo5: 'BO5',
}

// Couleurs de fond/panneau/bordure — mêmes valeurs exactes que
// exportComposition.js (--bg-base / --bg-panel-solid / --border-subtle),
// pour que les deux types de cartes Discord se ressemblent.
const CANVAS_BG = '#0a0e14'
const CANVAS_PANEL = '#131a23'
const CANVAS_BORDER = 'rgba(255, 255, 255, 0.09)'

// Mêmes piles de secours que exportComposition.js (voir ce fichier) —
// sans-serif en repli plutôt que le serif par défaut du canvas.
const FONT_DISPLAY = '"Barlow Condensed", sans-serif'
const FONT_BODY = '"Inter", sans-serif'

/**
 * @param {object} params
 * @param {string} [params.opponentName] Optionnel : un scrim, ou un match
 *   sans adversaire renseigné, n'affiche que l'étiquette de type.
 * @param {'scrim'|'match'} [params.matchType] Voir MATCH_TYPE dans utils/matches.js.
 * @param {'bo1'|'bo3'|'bo5'|string} [params.formatLabel] Clé de format (voir MATCH_FORMAT) ou libellé déjà formaté.
 * @param {Array<string|{name:string,thumbnail?:string}>} [params.maps] Une ou
 *   plusieurs maps déjà choisies (peut être vide : "à définir"). Accepte soit
 *   de simples noms (repli texte seul), soit des objets {name, thumbnail}
 *   pour afficher la vignette de la map à côté de son nom.
 * @param {string} [params.matchDate] Date ISO (YYYY-MM-DD), ou vide si à définir.
 * @param {string} [params.matchTime] Heure au format "HH:MM" (valeur d'un <input type="time">), optionnelle.
 * @returns {Promise<Blob>} PNG
 */
export async function renderMatchCard({ opponentName, matchType, formatLabel, maps = [], matchDate, matchTime }) {
  await ensureFontsReady()

  // Normalise en {name, thumbnail} : accepte aussi bien de simples chaînes
  // (ancien appelant / repli) que des objets déjà enrichis d'une vignette.
  const mapList = (maps.length ? maps : ['À définir']).map((m) =>
    typeof m === 'string' ? { name: m, thumbnail: null } : { name: m.name || 'Map', thumbnail: m.thumbnail || null }
  )
  const mapThumbnails = await Promise.all(mapList.map((m) => loadImage(m.thumbnail)))

  const SCALE = 2
  const W = 900
  const H = 480

  const canvas = document.createElement('canvas')
  canvas.width = W * SCALE
  canvas.height = H * SCALE
  const ctx = canvas.getContext('2d')
  ctx.scale(SCALE, SCALE)

  // ---------- Fond ----------
  ctx.fillStyle = CANVAS_BG
  ctx.fillRect(0, 0, W, H)
  const glow = ctx.createRadialGradient(W / 2, 0, 0, W / 2, 0, 480)
  glow.addColorStop(0, 'rgba(255,70,85,0.16)')
  glow.addColorStop(1, 'rgba(255,70,85,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, 260)

  // ---------- En-tête ----------
  // Le type (Scrim/Match) prime sur l'adversaire — voir MATCH_TYPE dans
  // utils/matches.js — l'adversaire, optionnel, ne reste qu'une précision
  // secondaire quand elle est renseignée (plus de "VS <adversaire>" systématique).
  const typeLabel = matchType === 'scrim' ? 'SCRIM' : 'MATCH'
  ctx.fillStyle = '#ff4655'
  ctx.font = `700 13px ${FONT_DISPLAY}`
  if ('letterSpacing' in ctx) ctx.letterSpacing = '1px'
  ctx.fillText(`— COMP BUILDER · ${typeLabel} PROGRAMMÉ`, 40, 42)
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px'

  ctx.fillStyle = '#ece8e1'
  ctx.font = `800 40px ${FONT_DISPLAY}`
  ctx.fillText(opponentName ? `${typeLabel} — ${opponentName.toUpperCase()}` : typeLabel, 40, 92)

  // Pastille de format (BO1/BO3/BO5), en haut à droite
  const formatKey = String(formatLabel || '').toLowerCase()
  const formatText = FORMAT_LABELS[formatKey] || (formatLabel ? String(formatLabel).toUpperCase() : 'BO1')
  const formatColor = '#7c8cff'
  ctx.font = `700 15px ${FONT_DISPLAY}`
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0.6px'
  const formatWidth = ctx.measureText(formatText).width
  const pillH = 34
  const pillW = formatWidth + 50
  const pillX = W - 40 - pillW
  const pillY = 40
  cutCornerRect(ctx, pillX, pillY, pillW, pillH, 10)
  ctx.fillStyle = hexWithAlpha(formatColor, 0.16)
  ctx.fill()
  ctx.strokeStyle = formatColor
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.fillStyle = formatColor
  ctx.textAlign = 'center'
  ctx.fillText(formatText, pillX + pillW / 2, pillY + pillH / 2 + 5)
  ctx.textAlign = 'left'
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px'

  ctx.strokeStyle = CANVAS_BORDER
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
    cutCornerRect(ctx, x, infoY, infoBoxW, infoBoxH, 12)
    ctx.fillStyle = CANVAS_PANEL
    ctx.fill()
    ctx.strokeStyle = CANVAS_BORDER
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.fillStyle = '#5c6a76'
    ctx.font = `700 12px ${FONT_DISPLAY}`
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0.6px'
    ctx.fillText(label.toUpperCase(), x + 22, infoY + 28)
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px'
    ctx.fillStyle = '#ece8e1'
    ctx.font = `800 22px ${FONT_DISPLAY}`
    ctx.fillText(value, x + 22, infoY + 58)
  }
  drawInfoBox(40, 'Date', dateLabel)
  drawInfoBox(40 + infoBoxW + infoGap, 'Heure', timeLabel)

  // ---------- Map(s) ----------
  const mapsY = infoY + infoBoxH + 30
  ctx.fillStyle = '#97a3ad'
  ctx.font = `700 12px ${FONT_DISPLAY}`
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0.6px'
  ctx.fillText(mapList.length > 1 ? 'MAPS' : 'MAP', 40, mapsY)
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px'

  // Vignette de map + nom, plutôt qu'un simple texte : la map se
  // reconnaît d'un coup d'œil, comme les cartes de map sur le site.
  const chipY = mapsY + 14
  const chipH = 44
  const thumbSize = 32
  const thumbPad = 6
  ctx.font = `600 15px ${FONT_BODY}`
  let chipX = 40
  let chipRowY = chipY
  mapList.forEach((m, i) => {
    const thumb = mapThumbnails[i]
    const textW = ctx.measureText(m.name).width
    const chipW = textW + (thumb ? thumbSize + thumbPad * 2 + 16 : 36)
    // Retour à la ligne si la carte de maps déborderait (Bo5 avec des
    // noms de maps longs) — improbable avec les maps Valorant actuelles
    // mais évite un débordement silencieux si la liste de maps s'allonge.
    if (chipX + chipW > W - 40 && chipX > 40) {
      chipX = 40
      chipRowY += chipH + 10
    }
    cutCornerRect(ctx, chipX, chipRowY, chipW, chipH, 8)
    ctx.fillStyle = 'rgba(255,255,255,0.06)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.14)'
    ctx.lineWidth = 1
    ctx.stroke()
    let textX = chipX + 18
    if (thumb) {
      const thumbX = chipX + thumbPad
      const thumbY = chipRowY + (chipH - thumbSize) / 2
      ctx.save()
      cutCornerRect(ctx, thumbX, thumbY, thumbSize, thumbSize, 5)
      ctx.clip()
      drawImageCover(ctx, thumb, thumbX, thumbY, thumbSize, thumbSize)
      ctx.restore()
      textX = thumbX + thumbSize + thumbPad + 4
    }
    ctx.fillStyle = '#ece8e1'
    ctx.fillText(m.name, textX, chipRowY + chipH / 2 + 5)
    chipX += chipW + 12
  })

  // ---------- Bannière de présence ----------
  // Aucun texte Discord n'accompagne cette image : l'instruction de vote
  // de présence doit donc être lisible directement dessus.
  const bannerY = H - 96
  const bannerH = 40
  const presenceColor = '#3ddc97'
  cutCornerRect(ctx, 40, bannerY, W - 80, bannerH, 10)
  ctx.fillStyle = hexWithAlpha(presenceColor, 0.14)
  ctx.fill()
  ctx.strokeStyle = presenceColor
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.fillStyle = presenceColor
  ctx.font = `700 16px ${FONT_DISPLAY}`
  ctx.textAlign = 'center'
  ctx.fillText('✅ PRÉSENT · ❌ ABSENT — RÉAGISSEZ SUR CE MESSAGE POUR CONFIRMER', W / 2, bannerY + bannerH / 2 + 6)
  ctx.textAlign = 'left'

  // ---------- Footer ----------
  ctx.textAlign = 'right'
  ctx.fillStyle = '#5c6a76'
  ctx.font = `500 12px ${FONT_BODY}`
  const generatedStr = new Date().toLocaleDateString('fr-FR')
  ctx.fillText(`Match annoncé le ${generatedStr} · frosefox.github.io/CompoBuilder`, W - 40, H - 26)
  ctx.textAlign = 'left'

  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
}

export function matchCardFileName(opponentName, matchType) {
  return `match-${slugify(opponentName || matchType || 'a-venir')}.png`
}
