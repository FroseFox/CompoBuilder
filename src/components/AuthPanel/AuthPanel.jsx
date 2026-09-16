import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import './AuthPanel.css'

/**
 * Seule porte d'entrée : connexion Discord (voir AuthContext.signInWithDiscord).
 * Pas de modale/formulaire ici — un clic déclenche directement la
 * redirection OAuth, la fiche joueur se crée automatiquement côté base
 * (handle_new_user) sans étape supplémentaire à faire sur le site.
 */
export default function AuthPanel() {
  const { user, isAdmin, signInWithDiscord, signOut } = useAuth()
  const { pushToast } = useToast()

  if (user) {
    return (
      <div className="auth-panel auth-panel__status">
        <span className={`auth-panel__badge ${isAdmin ? 'auth-panel__badge--admin' : ''}`}>
          {isAdmin ? '● Admin' : '● Connecté'}
        </span>
        <button
          className="btn btn-ghost"
          onClick={async () => {
            await signOut()
            pushToast('Déconnecté.', 'success')
          }}
        >
          Se déconnecter
        </button>
      </div>
    )
  }

  const handleClick = async () => {
    const error = await signInWithDiscord()
    if (error) pushToast(`Connexion Discord impossible : ${error.message}`, 'error')
  }

  return (
    <button className="btn btn-ghost auth-panel auth-panel__discord" onClick={handleClick}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M8 5.5c2.6-.9 5.4-.9 8 0M7 17c-2.2-.7-3.6-1.7-4.5-2.9C2 11 2.6 7.6 5 5.5c1-.6 2-1 3-1.2l.7 1.4M17 17c2.2-.7 3.6-1.7 4.5-2.9 .5-3.1-.1-6.5-2.5-8.6-1-.6-2-1-3-1.2l-.7 1.4"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <circle cx="9" cy="13" r="1.4" fill="currentColor" />
        <circle cx="15" cy="13" r="1.4" fill="currentColor" />
      </svg>
      Connexion Discord
    </button>
  )
}
