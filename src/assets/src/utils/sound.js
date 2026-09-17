/**
 * Sound design léger, généré à la volée via Web Audio API (aucun fichier
 * audio à charger). Construit à partir de bruit filtré (le principe d'un
 * vrai "clic" d'interface) et de sinusoïdes adoucies par un filtre
 * passe-bas — pas d'oscillateurs square/sawtooth bruts, pour éviter le
 * rendu chiptune/8-bit.
 */

const STORAGE_KEY = 'vcb-sound-enabled'

let audioCtx = null
let noiseBuffer = null

function getCtx() {
  if (typeof window === 'undefined') return null
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return null
  if (!audioCtx) audioCtx = new AC()
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {})
  }
  return audioCtx
}

function getNoiseBuffer(ctx) {
  if (!noiseBuffer || noiseBuffer.sampleRate !== ctx.sampleRate) {
    const length = Math.floor(ctx.sampleRate * 0.3)
    noiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate)
    const data = noiseBuffer.getChannelData(0)
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1
  }
  return noiseBuffer
}

export function isSoundEnabled() {
  if (typeof window === 'undefined') return false
  // Désactivé par défaut pour une première visite (un outil de prépa
  // d'équipe n'a pas besoin de bips à chaque clic) ; reste disponible
  // pour qui l'active volontairement via le bouton dans la sidebar.
  const v = window.localStorage.getItem(STORAGE_KEY)
  return v === '1'
}

export function setSoundEnabled(enabled) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0')
}

/** Bruit filtré en passe-bande : la base d'un "tick" d'interface propre. */
function noiseTick({ duration = 0.03, freq = 2600, q = 1.1, gain = 0.045, delay = 0 }) {
  const ctx = getCtx()
  if (!ctx) return
  const start = ctx.currentTime + delay

  const src = ctx.createBufferSource()
  src.buffer = getNoiseBuffer(ctx)

  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.setValueAtTime(freq, start)
  filter.Q.value = q

  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, start)
  g.gain.linearRampToValueAtTime(gain, start + 0.004)
  g.gain.exponentialRampToValueAtTime(0.0001, start + duration)

  src.connect(filter)
  filter.connect(g)
  g.connect(ctx.destination)
  src.start(start)
  src.stop(start + duration + 0.02)
}

/** Sinusoïde/triangle adoucie par un passe-bas — jamais de square/sawtooth cru. */
function softTone({ freq, duration = 0.1, type = 'sine', gain = 0.045, delay = 0, glideTo = null, lowpass = 2400 }) {
  const ctx = getCtx()
  if (!ctx) return
  const start = ctx.currentTime + delay

  const osc = ctx.createOscillator()
  osc.type = type
  osc.frequency.setValueAtTime(freq, start)
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(glideTo, 1), start + duration)

  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = lowpass
  filter.Q.value = 0.5

  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, start)
  g.gain.linearRampToValueAtTime(gain, start + 0.014)
  g.gain.exponentialRampToValueAtTime(0.0001, start + duration)

  osc.connect(filter)
  filter.connect(g)
  g.connect(ctx.destination)
  osc.start(start)
  osc.stop(start + duration + 0.02)
}

/** Joue un effet sonore nommé si le son est activé. Ne lève jamais d'erreur. */
export function playSound(name) {
  if (!isSoundEnabled()) return
  try {
    switch (name) {
      case 'click':
        noiseTick({ freq: 2600, duration: 0.028, gain: 0.05 })
        softTone({ freq: 220, duration: 0.03, gain: 0.018, lowpass: 800 })
        break
      case 'nav':
        noiseTick({ freq: 3400, duration: 0.02, gain: 0.035 })
        softTone({ freq: 320, duration: 0.09, gain: 0.03, glideTo: 440, lowpass: 1600 })
        break
      case 'hover':
        noiseTick({ freq: 4600, duration: 0.014, gain: 0.012 })
        break
      case 'success':
        softTone({ freq: 500, duration: 0.11, gain: 0.045, lowpass: 2200 })
        softTone({ freq: 700, duration: 0.16, gain: 0.04, delay: 0.08, lowpass: 2600 })
        break
      case 'error':
        softTone({ freq: 260, duration: 0.2, gain: 0.045, glideTo: 130, lowpass: 900 })
        noiseTick({ freq: 700, duration: 0.05, gain: 0.02, delay: 0.02 })
        break
      case 'notify':
        softTone({ freq: 440, duration: 0.09, gain: 0.035, lowpass: 1800 })
        break
      case 'toggle':
        noiseTick({ freq: 3000, duration: 0.018, gain: 0.03 })
        softTone({ freq: 620, duration: 0.05, gain: 0.024, lowpass: 2000 })
        break
      case 'delete':
        // Thud grave et bref : distinct du "error" (qui glisse), pour une
        // action volontaire et destructive plutôt qu'un échec.
        softTone({ freq: 200, duration: 0.14, gain: 0.05, glideTo: 90, lowpass: 700 })
        noiseTick({ freq: 500, duration: 0.03, gain: 0.025, delay: 0.01 })
        break
      case 'drop':
        // Petit "clac" mécanique pour un dépose de glisser-déposer réussi
        // (réorganisation des slots d'agents) — plus sec qu'un "click".
        noiseTick({ freq: 1800, duration: 0.02, gain: 0.04 })
        softTone({ freq: 180, duration: 0.06, gain: 0.03, glideTo: 130, lowpass: 900 })
        break
      default:
        break
    }
  } catch {
    // Environnement sans audio (SSR, navigateur restrictif, etc.) — silencieux.
  }
}
