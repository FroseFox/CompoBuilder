import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { isSoundEnabled, setSoundEnabled, playSound } from '../utils/sound'

const SoundContext = createContext(null)

/**
 * Ajoute un léger retour sonore sur toute l'interface : clic sur un bouton
 * ou un lien, survol des liens de la sidebar, sans avoir à instrumenter
 * chaque composant un par un (délégation d'évènements au niveau document).
 */
export function SoundProvider({ children }) {
  const [enabled, setEnabled] = useState(isSoundEnabled())
  const lastHovered = useRef(null)

  useEffect(() => {
    const handleClick = (e) => {
      if (!isSoundEnabled()) return
      const interactive = e.target.closest?.('button, a, [role="button"]')
      if (!interactive || interactive.disabled) return
      playSound(interactive.classList.contains('sidebar__link') ? 'nav' : 'click')
    }

    const handleHover = (e) => {
      if (!isSoundEnabled()) return
      const link = e.target.closest?.('.sidebar__link')
      if (link && link !== lastHovered.current) {
        lastHovered.current = link
        playSound('hover')
      } else if (!link) {
        lastHovered.current = null
      }
    }

    document.addEventListener('click', handleClick, true)
    document.addEventListener('mouseover', handleHover, true)
    return () => {
      document.removeEventListener('click', handleClick, true)
      document.removeEventListener('mouseover', handleHover, true)
    }
  }, [])

  const toggleSound = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev
      setSoundEnabled(next)
      if (next) playSound('toggle')
      return next
    })
  }, [])

  return (
    <SoundContext.Provider value={{ enabled, toggleSound }}>
      {children}
    </SoundContext.Provider>
  )
}

export function useSound() {
  const ctx = useContext(SoundContext)
  if (!ctx) throw new Error('useSound doit être utilisé dans SoundProvider')
  return ctx
}
