import { Component } from 'react'
import './ErrorBoundary.css'

/**
 * Filet de sécurité global : si un composant plante au rendu (erreur JS
 * imprévue), affiche un écran d'erreur avec un bouton pour recharger au
 * lieu de laisser React démonter toute l'app (écran blanc silencieux).
 *
 * Ne rattrape que les erreurs de rendu React (comportement natif des
 * error boundaries) — pas les erreurs dans des gestionnaires d'événements
 * ou du code asynchrone, qui sont déjà gérées au cas par cas (toasts,
 * try/catch) ailleurs dans l'app.
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('Erreur non rattrapée dans l\'application :', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <div className="error-boundary__box">
            <h1>Une erreur inattendue est survenue</h1>
            <p>
              Désolé, quelque chose s'est mal passé. Vos données ne sont pas
              perdues — elles sont sauvegardées sur le serveur, pas dans
              cette page.
            </p>
            <button type="button" onClick={() => window.location.reload()}>
              Recharger la page
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
