import { useEffect, useState } from 'react'
import ConfirmDialog from '../ConfirmDialog/ConfirmDialog'

function isIos() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent)
}

function isStandalone() {
  // Chrome/Edge/Android exposent display-mode: standalone une fois l'app
  // installée et lancée depuis l'écran d'accueil ; navigator.standalone est
  // l'équivalent (non standard) sur iOS/iPadOS Safari.
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  )
}

/**
 * Gère la disponibilité de l'installation PWA. Deux chemins bien distincts :
 * - Chrome/Edge/Android déclenchent `beforeinstallprompt` : on intercepte cet
 *   évènement (sinon le navigateur affiche son propre mini-infobar, moins
 *   visible) et on le rejoue nous-mêmes via `.prompt()` au clic du bouton.
 * - iOS/iPadOS Safari ne déclenche jamais cet évènement (pas d'API dédiée) :
 *   la seule voie est le geste manuel Partager -> "Sur l'écran d'accueil",
 *   qu'on ne peut pas déclencher par code, juste expliquer.
 * Sur tout le reste (desktop Firefox, navigateur déjà installé...), le
 * bouton reste caché : rien d'actionnable à proposer.
 */
function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [installed, setInstalled] = useState(() => isStandalone())

  useEffect(() => {
    const onBeforeInstall = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    const onInstalled = () => {
      setInstalled(true)
      setDeferredPrompt(null)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const canInstall = !installed && (deferredPrompt !== null || isIos())

  const triggerInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') setInstalled(true)
      setDeferredPrompt(null)
      return true // prompt natif géré, rien d'autre à afficher
    }
    return false // pas de prompt natif dispo (iOS) -> instructions manuelles
  }

  return { canInstall, triggerInstall }
}

/**
 * Bouton "Installer l'application", affiché seulement quand une installation
 * est réellement possible (voir useInstallPrompt) — jamais un bouton mort.
 * `variant="icon"` pour la barre d'actions desktop (même famille que
 * son/thème/réglages), `variant="text"` pour le panneau mobile en accordéon.
 */
export default function InstallAppButton({ variant = 'icon' }) {
  const { canInstall, triggerInstall } = useInstallPrompt()
  const [showIosHelp, setShowIosHelp] = useState(false)

  if (!canInstall) return null

  const handleClick = async () => {
    const handledNatively = await triggerInstall()
    if (!handledNatively) setShowIosHelp(true)
  }

  return (
    <>
      {variant === 'icon' ? (
        <button
          type="button"
          className="btn btn-ghost btn-icon topnav__icon-btn"
          onClick={handleClick}
          aria-label="Installer l'application"
          title="Installer l'application"
        >
          <InstallIcon />
        </button>
      ) : (
        <button type="button" className="btn btn-ghost" onClick={handleClick}>
          Installer l'application
        </button>
      )}

      <ConfirmDialog
        open={showIosHelp}
        title="Installer Comp Builder"
        description={'Sur iPhone/iPad : appuyez sur le bouton Partager (le carré avec une flèche vers le haut) dans la barre de Safari, puis choisissez « Sur l’écran d’accueil ».'}
        confirmLabel="Compris"
        cancelLabel="Fermer"
        danger={false}
        onConfirm={() => setShowIosHelp(false)}
        onCancel={() => setShowIosHelp(false)}
      />
    </>
  )
}

function InstallIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M12 3v12M7.5 10.5 12 15l4.5-4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 16.5V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
