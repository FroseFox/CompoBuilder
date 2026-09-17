import { useLocation } from 'react-router-dom'
import './RouteProgress.css'

/**
 * Fine barre de progression en haut de l'écran, façon navigateur, qui se
 * relance à chaque changement de route (nouvelle key -> nouvel élément DOM
 * -> l'animation CSS repart de zéro). Volontairement hors d'AnimatePresence
 * et de <Routes> : un composant toujours monté, indépendant du cycle de vie
 * des pages, ne peut pas interagir avec leur suivi d'entrée/sortie (voir le
 * bug historique du prop `layout` de Framer Motion qui cassait justement
 * ce suivi ailleurs dans l'arbre).
 */
export default function RouteProgress() {
  const location = useLocation()

  return (
    <div className="route-progress" aria-hidden="true">
      <div className="route-progress__bar" key={location.pathname} />
    </div>
  )
}
