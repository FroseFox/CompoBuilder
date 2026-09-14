// ============================================================
// Génère une image PNG partageable (carte "team comp") pour une
// composition donnée, dessinée sur un <canvas> hors-DOM.
//
// Les portraits d'agents viennent de media.valorant-api.com (domaine
// externe) : on les charge avec `crossOrigin = 'anonymous'`. Si le
// serveur ne renvoie pas les en-têtes CORS attendus, l'image échoue
// simplement à charger (onerror) plutôt que de "tainter" le canvas —
// on retombe alors sur un simple médaillon avec l'initiale de l'agent,
// et canvas.toBlob() reste utilisable dans tous les cas.
// ============================================================

import { STATUS, STATUS_META } from './storage'

const ROLE_COLORS = {
  Duelliste: '#ff5f6d',
  Duelist: '#ff5f6d',
  Contrôleur: '#7c8cff',
  Controller: '#7c8cff',
  Initiateur: '#ffb54c',
  Initiator: '#ffb54c',
  Sentinelle: '#3ddc97',
  Sentinel: '#3ddc97',
}

// STATUS_META[...].color est désormais une référence CSS (var(--role-*)),
// utile partout ailleurs via style={{ '--accent-card-color': ... }} mais
// inexploitable ici : un <canvas> ne fait pas partie de la cascade CSS de
// la page, donc ctx.fillStyle/strokeStyle ne résout jamais un var(...), et
// hexWithAlpha() ci-dessous attend un "#rrggbb" littéral à découper. On
// garde donc une palette hex dédiée au rendu canvas, alignée sur les
// valeurs de src/styles/variables.css (mêmes teintes que le reste de
// l'app, juste dupliquées ici car le canvas ne peut pas lire les tokens).
const STATUS_CANVAS_COLORS = {
  [STATUS.VALIDATED]: '#2fd999',
  [STATUS.TESTING]: '#ffb84d',
  [STATUS.NEEDS_WORK]: '#ff6b57',
  [STATUS.TODO]: '#d9c9b8',
}

function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null)
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function hexWithAlpha(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/**
 * @param {object} params
 * @param {{name:string}} params.map
 * @param {{name:string,status:string,slots:Array<{agentUuid:?string,playerId:?string}>}} params.composition
 * @param {Map<string,object>} params.agentByUuid
 * @param {Record<string,{pseudo:string,color:string}>} params.players
 * @returns {Promise<Blob>} PNG
 */
export async function renderCompositionCard({ map, composition, agentByUuid, players }) {
  const SCALE = 2
  const W = 1000
  const H = 430
  const SLOT_W = 176

  const canvas = document.createElement('canvas')
  canvas.width = W * SCALE
  canvas.height = H * SCALE
  const ctx = canvas.getContext('2d')
  ctx.scale(SCALE, SCALE)

  // ---------- Fond ----------
  ctx.fillStyle = '#0b1119'
  ctx.fillRect(0, 0, W, H)
  const glow = ctx.createRadialGradient(W / 2, 0, 0, W / 2, 0, 520)
  glow.addColorStop(0, 'rgba(255,70,85,0.16)')
  glow.addColorStop(1, 'rgba(255,70,85,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, 240)

  // ---------- En-tête ----------
  ctx.fillStyle = '#ff4655'
  ctx.font = '700 13px Arial'
  ctx.fillText('— COMP BUILDER', 40, 42)

  ctx.fillStyle = '#ece8e1'
  ctx.font = '700 34px Arial'
  ctx.fillText(map?.name || 'Map', 40, 84)

  ctx.fillStyle = '#97a3ad'
  ctx.font = '600 15px Arial'
  ctx.fillText(composition.name, 40, 108)

  // pastille de statut, en haut à droite
  const meta = STATUS_META[composition.status] || STATUS_META.todo
  const statusColor = STATUS_CANVAS_COLORS[composition.status] || STATUS_CANVAS_COLORS[STATUS.TODO]
  const label = meta.label.toUpperCase()
  ctx.font = '700 12px Arial'
  const labelWidth = ctx.measureText(label).width
  const pillH = 30
  const pillW = labelWidth + 46
  const pillX = W - 40 - pillW
  const pillY = 38
  roundRect(ctx, pillX, pillY, pillW, pillH, pillH / 2)
  ctx.fillStyle = hexWithAlpha(statusColor, 0.14)
  ctx.fill()
  ctx.strokeStyle = statusColor
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.fillStyle = statusColor
  ctx.beginPath()
  ctx.arc(pillX + 18, pillY + pillH / 2, 4, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillText(label, pillX + 30, pillY + pillH / 2 + 4)

  ctx.strokeStyle = 'rgba(255,255,255,0.08)'
  ctx.beginPath()
  ctx.moveTo(40, 140)
  ctx.lineTo(W - 40, 140)
  ctx.stroke()

  // ---------- Emplacements d'agents ----------
  const slots = composition.slots
  const rowY = 168
  const iconSize = 84
  const startX = (W - SLOT_W * slots.length) / 2

  const images = await Promise.all(
    slots.map((s) => {
      const agent = s.agentUuid ? agentByUuid.get(s.agentUuid) : null
      return loadImage(agent?.icon || null)
    })
  )

  slots.forEach((slot, i) => {
    const x = startX + i * SLOT_W
    const cx = x + SLOT_W / 2
    const agent = slot.agentUuid ? agentByUuid.get(slot.agentUuid) : null
    const player = slot.playerId ? players[slot.playerId] : null
    const img = images[i]

    roundRect(ctx, x + 8, rowY, SLOT_W - 16, 216, 14)
    ctx.fillStyle = '#141e29'
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'
    ctx.lineWidth = 1
    ctx.stroke()

    const iconY = rowY + 22
    ctx.save()
    ctx.beginPath()
    ctx.arc(cx, iconY + iconSize / 2, iconSize / 2, 0, Math.PI * 2)
    ctx.closePath()
    ctx.fillStyle = 'rgba(255,255,255,0.06)'
    ctx.fill()
    ctx.clip()
    if (img) {
      ctx.drawImage(img, cx - iconSize / 2, iconY, iconSize, iconSize)
    } else if (agent) {
      ctx.fillStyle = '#5c6a76'
      ctx.font = '700 32px Arial'
      ctx.textAlign = 'center'
      ctx.fillText(agent.name[0], cx, iconY + iconSize / 2 + 11)
    }
    ctx.restore()

    ctx.textAlign = 'center'
    ctx.fillStyle = '#ece8e1'
    ctx.font = '700 15px Arial'
    ctx.fillText(agent ? agent.name : 'Vide', cx, iconY + iconSize + 28)

    if (agent) {
      const roleColor = ROLE_COLORS[agent.role?.name] || '#c7cdd6'
      ctx.fillStyle = roleColor
      ctx.font = '700 10px Arial'
      ctx.fillText((agent.role?.name || '').toUpperCase(), cx, iconY + iconSize + 46)
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.06)'
    ctx.beginPath()
    ctx.moveTo(x + 22, iconY + iconSize + 60)
    ctx.lineTo(x + SLOT_W - 22, iconY + iconSize + 60)
    ctx.stroke()

    ctx.font = '600 12px Arial'
    const playerLabel = player ? player.pseudo : 'Aucun joueur'
    const playerColor = player ? player.color || '#97a3ad' : '#5c6a76'
    const textWidth = ctx.measureText(playerLabel).width
    const dotR = player ? 4 : 0
    const gap = player ? 8 : 0
    const blockStart = cx - (dotR * 2 + gap + textWidth) / 2
    if (player) {
      ctx.fillStyle = playerColor
      ctx.beginPath()
      ctx.arc(blockStart + dotR, iconY + iconSize + 82, dotR, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.textAlign = 'left'
    ctx.fillStyle = player ? '#97a3ad' : '#5c6a76'
    ctx.fillText(playerLabel, blockStart + dotR * 2 + gap, iconY + iconSize + 86)
  })

  ctx.textAlign = 'right'
  ctx.fillStyle = '#5c6a76'
  ctx.font = '500 11px Arial'
  const dateStr = new Date().toLocaleDateString('fr-FR')
  ctx.fillText(`Généré le ${dateStr} · frosefox.github.io/CompoBuilder`, W - 40, H - 26)
  ctx.textAlign = 'left'

  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
}

function slugify(text) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export function compositionFileName(map, composition) {
  return `compo-${slugify(map?.name || 'map')}-${slugify(composition.name)}.png`
}
