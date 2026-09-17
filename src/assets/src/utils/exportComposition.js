// ============================================================
// Génère une image PNG partageable (carte "team comp") pour une
// composition donnée, dessinée sur un <canvas> hors-DOM.
//
// Identité visuelle alignée sur le reste du site (thème "menu
// Valorant" — voir src/styles/variables.css) : mêmes couleurs, mêmes
// polices (Barlow Condensed / Inter, chargées par le site via
// index.html) et mêmes coins coupés que les composants React —
// avant cette passe, l'image utilisait Arial et des pilules
// pleinement arrondies, ce qui la faisait détonner à côté du reste
// de l'interface et nuisait à la lisibilité sur Discord.
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
// garde donc une palette hex dédiée au rendu canvas — recopiée ici
// exactement depuis src/styles/variables.css (--role-sentinel/-initiator/
// -duelist/-flex), pour que le statut d'une composition ait rigoureusement
// la même couleur sur le site et sur l'image envoyée à l'équipe.
const STATUS_CANVAS_COLORS = {
  [STATUS.VALIDATED]: '#3ddc97', // --role-sentinel
  [STATUS.TESTING]: '#ffb54c', // --role-initiator
  [STATUS.NEEDS_WORK]: '#ff5f6d', // --role-duelist
  [STATUS.TODO]: '#c7cdd6', // --role-flex
}

// Couleurs de fond/panneau/bordure — copiées exactement de --bg-base,
// --bg-panel-solid et --border-subtle (thème sombre, variables.css).
// Le canvas ne peut pas lire les tokens CSS, donc dupliquées ici ; le
// commentaire vaut mise en garde si la palette du site change un jour.
const CANVAS_BG = '#0a0e14'
const CANVAS_PANEL = '#131a23'
const CANVAS_BORDER = 'rgba(255, 255, 255, 0.09)'

// Piles de secours alignées sur --font-display/--font-body de
// variables.css : si Barlow Condensed/Inter n'ont pas fini de charger
// (ou échouent à charger), le canvas doit retomber sur une police sans
// empattement — jamais sur le serif générique par défaut du canvas, qui
// détonnerait complètement avec l'identité du site.
const FONT_DISPLAY = '"Barlow Condensed", sans-serif'
const FONT_BODY = '"Inter", sans-serif'

// Exportée pour être réutilisée par matchCard.js (vignettes de map).
export function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null)
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

// Dessine `img` en remplissant exactement la boîte (x, y, w, h), recadrée
// depuis son centre — équivalent canvas de `object-fit: cover` (déjà
// utilisé un peu partout côté CSS : MapCard, AgentSlot…). Exportée pour
// être réutilisée par matchCard.js (vignettes de map).
export function drawImageCover(ctx, img, x, y, w, h) {
  const scale = Math.max(w / img.width, h / img.height)
  const sw = w / scale
  const sh = h / scale
  const sx = (img.width - sw) / 2
  const sy = (img.height - sh) / 2
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h)
}

// Le site charge Barlow Condensed / Inter via Google Fonts (index.html),
// mais rien ne garantit qu'elles aient fini de se résoudre au moment où
// l'équipe clique sur "Exporter" ou "Envoyer" — un dessin canvas trop
// précoce retombe silencieusement sur la police système par défaut (pas
// d'erreur, juste le mauvais rendu). On force donc le chargement des
// graisses utilisées ci-dessous avant de dessiner le moindre texte.
// Exportée pour être réutilisée par matchCard.js.
export async function ensureFontsReady() {
  if (typeof document === 'undefined' || !document.fonts) return
  try {
    await Promise.all([
      document.fonts.load(`800 34px ${FONT_DISPLAY}`),
      document.fonts.load(`700 20px ${FONT_DISPLAY}`),
      document.fonts.load(`700 13px ${FONT_DISPLAY}`),
      document.fonts.load(`600 15px ${FONT_BODY}`),
      document.fonts.load(`500 12px ${FONT_BODY}`),
    ])
    await document.fonts.ready
  } catch {
    // Pas grave si le chargement échoue (police auto-hébergée absente,
    // navigateur ancien…) : on continue avec le repli système plutôt que
    // de bloquer l'export.
  }
}

// Applique un espacement de lettres aux libellés en majuscules, comme le
// fait le site en CSS (letter-spacing ~0.04em sur les onglets/labels —
// voir Navbar.css) ; `ctx.letterSpacing` n'existe pas sur tous les
// navigateurs, d'où la vérification avant usage.
function setLetterSpacing(ctx, px) {
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${px}px`
}
function resetLetterSpacing(ctx) {
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px'
}

// Exportée : réutilisée par matchCard.js (carte d'annonce de match), même
// identité visuelle que la carte de composition ci-dessous — évite de
// dupliquer ces primitives de dessin.
//
// Coins coupés (et non arrondis) sur deux angles opposés — même
// silhouette que la classe utilitaire CSS `.cut-corner` du site
// (clip-path: polygon(Npx 0, 100% 0, 100% calc(100% - Npx), …)), pour
// que les cartes/pastilles dessinées en canvas aient la même identité
// "panneau tactique" anguleuse que les composants React.
export function cutCornerRect(ctx, x, y, w, h, cut) {
  const c = Math.min(cut, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + c, y)
  ctx.lineTo(x + w, y)
  ctx.lineTo(x + w, y + h - c)
  ctx.lineTo(x + w - c, y + h)
  ctx.lineTo(x, y + h)
  ctx.lineTo(x, y + c)
  ctx.closePath()
}

export function hexWithAlpha(hex, alpha) {
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
 * @param {'export'|'vote'} [params.mode] 'export' (défaut) : pastille de
 *   statut habituelle, pour le bouton "Exporter" de l'Editor. 'vote' :
 *   remplace la pastille par une bannière d'appel au vote — utilisé
 *   quand cette image est envoyée sur Discord à la place du message
 *   texte (voir sendDiscordVoteImage), pour que l'instruction de vote
 *   soit portée par l'image elle-même.
 * @returns {Promise<Blob>} PNG
 */
export async function renderCompositionCard({ map, composition, agentByUuid, players, mode = 'export' }) {
  await ensureFontsReady()

  const SCALE = 2
  const W = 1000
  // En mode 'vote', la bannière d'appel au vote a besoin de sa propre
  // ligne sous l'en-tête (nom de map + composition) : les caser sur la
  // même bande verticale faisait chevaucher la bannière et le titre
  // (bug remonté par l'équipe). On agrandit donc le canvas de la
  // hauteur de cette ligne plutôt que de la faire tenir de force.
  const VOTE_BANNER_EXTRA = 56
  const H = 430 + (mode === 'vote' ? VOTE_BANNER_EXTRA : 0)
  const SLOT_W = 176

  const canvas = document.createElement('canvas')
  canvas.width = W * SCALE
  canvas.height = H * SCALE
  const ctx = canvas.getContext('2d')
  ctx.scale(SCALE, SCALE)

  const dividerY = 140 + (mode === 'vote' ? VOTE_BANNER_EXTRA : 0)
  const slots = composition.slots

  // Toutes les images en amont (splash de la map pour le bandeau
  // d'en-tête, icônes d'agents pour le flou d'ambiance des emplacements
  // — voir plus bas) : un échec de chargement retombe sur `null` sans
  // bloquer l'export, voir loadImage().
  const [mapImg, ...agentImages] = await Promise.all([
    loadImage(map?.image || map?.thumbnail || null),
    ...slots.map((s) => {
      const agent = s.agentUuid ? agentByUuid.get(s.agentUuid) : null
      return loadImage(agent?.icon || null)
    }),
  ])

  // ---------- Fond ----------
  ctx.fillStyle = CANVAS_BG
  ctx.fillRect(0, 0, W, H)

  // ---------- Bandeau d'en-tête : splash de la map ----------
  // Même logique que .map-card__image + .map-card__scrim sur le site
  // (image nette, pas de flou ici — le flou est réservé aux agents, voir
  // plus bas) : la map devient visuellement identifiable au premier
  // coup d'œil au lieu d'un simple nom en texte sur fond plat.
  if (mapImg) {
    drawImageCover(ctx, mapImg, 0, 0, W, dividerY)
    // Voile dégradé horizontal : texte bien lisible côté gauche (où il
    // est posé), image qui respire côté droit.
    const scrim = ctx.createLinearGradient(0, 0, W, 0)
    scrim.addColorStop(0, 'rgba(10, 14, 20, 0.94)')
    scrim.addColorStop(0.55, 'rgba(10, 14, 20, 0.7)')
    scrim.addColorStop(1, 'rgba(10, 14, 20, 0.22)')
    ctx.fillStyle = scrim
    ctx.fillRect(0, 0, W, dividerY)
    // Fondu vers le bas du bandeau, pour une transition propre avec le
    // reste de la carte plutôt qu'un bord net sur la ligne de séparation.
    const fade = ctx.createLinearGradient(0, dividerY - 46, 0, dividerY)
    fade.addColorStop(0, 'rgba(10, 14, 20, 0)')
    fade.addColorStop(1, CANVAS_BG)
    ctx.fillStyle = fade
    ctx.fillRect(0, dividerY - 46, W, 46)
  }

  // Lueur de marque — toujours présente, image de map ou non.
  const glow = ctx.createRadialGradient(W / 2, 0, 0, W / 2, 0, 520)
  glow.addColorStop(0, 'rgba(255,70,85,0.16)')
  glow.addColorStop(1, 'rgba(255,70,85,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, 240)

  // ---------- En-tête ----------
  ctx.fillStyle = '#ff4655'
  ctx.font = `700 13px ${FONT_DISPLAY}`
  setLetterSpacing(ctx, 1)
  ctx.fillText('— COMP BUILDER', 40, 42)
  resetLetterSpacing(ctx)

  ctx.fillStyle = '#ece8e1'
  ctx.font = `800 36px ${FONT_DISPLAY}`
  ctx.fillText((map?.name || 'Map').toUpperCase(), 40, 86)

  ctx.fillStyle = '#97a3ad'
  ctx.font = `600 16px ${FONT_BODY}`
  ctx.fillText(composition.name, 40, 110)

  if (mode === 'vote') {
    // Bannière d'appel au vote, pleine largeur — remplace la pastille
    // de statut : l'image ne s'accompagne d'aucun texte Discord, cette
    // instruction doit donc être lisible directement sur l'image.
    // Placée sous l'en-tête (pas à sa hauteur, voir VOTE_BANNER_EXTRA
    // ci-dessus) pour ne pas chevaucher le nom de la map / composition.
    const bannerY = 126
    const bannerH = 40
    const voteColor = '#ffb84d'
    cutCornerRect(ctx, 40, bannerY, W - 80, bannerH, 10)
    ctx.fillStyle = hexWithAlpha(voteColor, 0.16)
    ctx.fill()
    ctx.strokeStyle = voteColor
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.fillStyle = voteColor
    ctx.font = `700 16px ${FONT_DISPLAY}`
    ctx.textAlign = 'center'
    // Pas d'emoji "🗳️" ici : moins courant que ✅/❌, il s'affiche mal
    // (glyphe de repli) sur certains systèmes une fois figé dans le PNG —
    // contrairement à un bouton d'UI, une image Discord ne se corrige pas.
    ctx.fillText('VOTE — RÉAGISSEZ ✅ POUR VALIDER, ❌ POUR REFUSER', W / 2, bannerY + bannerH / 2 + 6)
    ctx.textAlign = 'left'
  } else {
    // pastille de statut, en haut à droite
    const meta = STATUS_META[composition.status] || STATUS_META.todo
    const statusColor = STATUS_CANVAS_COLORS[composition.status] || STATUS_CANVAS_COLORS[STATUS.TODO]
    const label = meta.label.toUpperCase()
    ctx.font = `700 13px ${FONT_DISPLAY}`
    setLetterSpacing(ctx, 0.6)
    const labelWidth = ctx.measureText(label).width
    const pillH = 30
    const pillW = labelWidth + 46
    const pillX = W - 40 - pillW
    const pillY = 38
    cutCornerRect(ctx, pillX, pillY, pillW, pillH, 8)
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
    resetLetterSpacing(ctx)
  }

  ctx.strokeStyle = CANVAS_BORDER
  ctx.beginPath()
  ctx.moveTo(40, dividerY)
  ctx.lineTo(W - 40, dividerY)
  ctx.stroke()

  // ---------- Emplacements d'agents ----------
  const rowY = 168 + (mode === 'vote' ? VOTE_BANNER_EXTRA : 0)
  const iconSize = 84
  const startX = (W - SLOT_W * slots.length) / 2
  const slotW = SLOT_W - 16
  const slotH = 216

  slots.forEach((slot, i) => {
    const x = startX + i * SLOT_W
    const cx = x + SLOT_W / 2
    const agent = slot.agentUuid ? agentByUuid.get(slot.agentUuid) : null
    const player = slot.playerId ? players[slot.playerId] : null
    const img = agentImages[i]

    cutCornerRect(ctx, x + 8, rowY, slotW, slotH, 14)
    if (img) {
      // Effet "verre dépoli" — même logique que .agent-slot en CSS sur
      // le site (fond flouté à partir de l'icône de l'agent, avec un
      // panneau translucide par-dessus : voir .agent-slot__portrait-
      // placeholder + backdrop-filter dans AgentSlot.css). Un <canvas>
      // ne peut pas faire de vrai backdrop-filter (pas d'arrière-plan
      // "live" à flouter), donc on simule : on dessine l'image floutée
      // nous-mêmes, puis un panneau semi-transparent par-dessus.
      ctx.save()
      ctx.clip()
      const bleed = 26 // déborde largement le cadre pour qu'un bord flou ne laisse jamais transparaître de zone vide
      ctx.filter = 'blur(16px) saturate(1.2)'
      ctx.globalAlpha = 0.6
      drawImageCover(ctx, img, x + 8 - bleed, rowY - bleed, slotW + bleed * 2, slotH + bleed * 2)
      ctx.filter = 'none'
      ctx.globalAlpha = 1
      ctx.fillStyle = 'rgba(19, 26, 35, 0.78)' // --bg-panel, comme le fond translucide de .agent-slot
      ctx.fillRect(x + 8 - bleed, rowY - bleed, slotW + bleed * 2, slotH + bleed * 2)
      ctx.restore()
    } else {
      ctx.fillStyle = CANVAS_PANEL
      ctx.fill()
    }
    cutCornerRect(ctx, x + 8, rowY, slotW, slotH, 14)
    ctx.strokeStyle = CANVAS_BORDER
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
      ctx.font = `800 34px ${FONT_DISPLAY}`
      ctx.textAlign = 'center'
      ctx.fillText(agent.name[0], cx, iconY + iconSize / 2 + 12)
    }
    ctx.restore()

    ctx.textAlign = 'center'
    ctx.fillStyle = '#ece8e1'
    ctx.font = `700 17px ${FONT_DISPLAY}`
    ctx.fillText(agent ? agent.name : 'Vide', cx, iconY + iconSize + 29)

    if (agent) {
      const roleColor = ROLE_COLORS[agent.role?.name] || '#c7cdd6'
      ctx.fillStyle = roleColor
      ctx.font = `700 11px ${FONT_DISPLAY}`
      setLetterSpacing(ctx, 0.8)
      ctx.fillText((agent.role?.name || '').toUpperCase(), cx, iconY + iconSize + 47)
      resetLetterSpacing(ctx)
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.06)'
    ctx.beginPath()
    ctx.moveTo(x + 22, iconY + iconSize + 60)
    ctx.lineTo(x + SLOT_W - 22, iconY + iconSize + 60)
    ctx.stroke()

    ctx.font = `600 13px ${FONT_BODY}`
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
  ctx.font = `500 12px ${FONT_BODY}`
  const dateStr = new Date().toLocaleDateString('fr-FR')
  const footerVerb = mode === 'vote' ? 'Vote lancé le' : 'Généré le'
  ctx.fillText(`${footerVerb} ${dateStr} · frosefox.github.io/CompoBuilder`, W - 40, H - 26)
  ctx.textAlign = 'left'

  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
}

export function slugify(text) {
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
