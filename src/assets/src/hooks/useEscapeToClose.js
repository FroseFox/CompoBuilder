import { useEffect } from 'react'

/**
 * Ferme une modale/un panneau avec la touche Échap — cohérent avec les
 * clics sur le voile en arrière-plan, qui fonctionnaient déjà partout.
 * Sans ce hook, seule la recherche globale (GlobalSearch) réagissait à
 * Échap (gérée localement sur son champ de recherche) : les autres
 * modales (sélection d'agent, comparaison, réglages, confirmation)
 * ne se fermaient qu'au clic, ce qui casse l'habitude une fois qu'on a
 * pris le réflexe clavier ailleurs dans l'appli.
 */
export function useEscapeToClose(active, onClose) {
  useEffect(() => {
    if (!active) return undefined
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [active, onClose])
}
