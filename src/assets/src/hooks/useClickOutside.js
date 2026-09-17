import { useEffect } from 'react'

/**
 * Ferme un petit panneau (popover profil, menu...) au clic en dehors de
 * `ref` — pour un panneau ancré à côté d'un bouton, pas assez "modal" pour
 * mériter un voile plein écran comme les vraies modales de l'appli.
 */
export function useClickOutside(ref, active, onClose) {
  useEffect(() => {
    if (!active) return undefined
    const handlePointerDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [ref, active, onClose])
}
