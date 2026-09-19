import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useAuth } from '../../context/AuthContext'
import { usePlayers } from '../../context/PlayersContext'
import { useToast } from '../../context/ToastContext'
import { useEscapeToClose } from '../../hooks/useEscapeToClose'
import { useClickOutside } from '../../hooks/useClickOutside'
import PlayerAvatar from '../PlayerAvatar/PlayerAvatar'
import discordMark from '../../assets/discord-mark.png'
import './AuthPanel.css'

/**
 * Icône utilisée pour le bouton "Connexion Discord" (pas encore connecté) —
 * le même fichier que le badge affiché sur l'avatar une fois connecté (voir
 * PlayerAvatar/showDiscordBadge), pour ne garder qu'une seule image à
 * remplacer si besoin : src/assets/discord-mark.png.
 */
function DiscordMark({ size = 15 }) {
  return <img src={discordMark} alt="" style={{ height: size, width: 'auto', display: 'block' }} />
}

/**
 * Seule porte d'entrée : connexion Discord (voir AuthContext.signInWithDiscord).
 * Une fois connecté, affiche l'avatar/pseudo du joueur (pas juste un badge
 * générique "Connecté") avec un petit point vert = connecté via Discord,
 * et un anneau doré = administrateur — cliquer ouvre une mini fenêtre de
 * profil (fiche joueur + déconnexion), sans routing/page dédiée.
 */
export default function AuthPanel() {
  const { user, isAdmin, signInWithDiscord, signOut } = useAuth()
  const { players } = usePlayers()
  const { pushToast } = useToast()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  useEscapeToClose(open, () => setOpen(false))
  useClickOutside(wrapRef, open, () => setOpen(false))

  const myPlayer = useMemo(() => {
    if (!user) return null
    return Object.values(players).find((p) => p.userId === user.id) || null
  }, [players, user])

  if (!user) {
    const handleLogin = async () => {
      const error = await signInWithDiscord()
      if (error) pushToast(`Connexion Discord impossible : ${error.message}`, 'error')
    }
    return (
      <button className="btn btn-ghost auth-panel auth-panel__discord" onClick={handleLogin}>
        <DiscordMark size={15} />
        Connexion Discord
      </button>
    )
  }

  const displayName =
    myPlayer?.pseudo ||
    user.user_metadata?.custom_claims?.global_name ||
    user.user_metadata?.full_name ||
    'Connecté'

  const handleSignOut = async () => {
    setOpen(false)
    await signOut()
    pushToast('Déconnecté.', 'success')
  }

  return (
    <div className="auth-panel auth-panel__wrap" ref={wrapRef}>
      <button
        type="button"
        className="auth-panel__trigger"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <span className={`auth-panel__ring${isAdmin ? ' auth-panel__ring--admin' : ''}`}>
          <PlayerAvatar player={myPlayer} size="sm" title={displayName} showDiscordBadge />
        </span>
        <span className="auth-panel__name">{displayName}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="auth-panel__popover glass-panel"
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 420, damping: 30 } }}
            exit={{ opacity: 0, y: -6, scale: 0.98, transition: { duration: 0.12 } }}
          >
            <div className="auth-panel__popover-head">
              <span className={`auth-panel__ring auth-panel__ring--lg${isAdmin ? ' auth-panel__ring--admin' : ''}`}>
                <PlayerAvatar player={myPlayer} size="lg" title={displayName} showDiscordBadge />
              </span>
              <div className="auth-panel__popover-info">
                <strong>{displayName}</strong>
                <span className={`auth-panel__popover-status${isAdmin ? ' auth-panel__popover-status--admin' : ''}`}>
                  {isAdmin ? '★ Administrateur' : '● Connecté via Discord'}
                </span>
              </div>
            </div>

            {myPlayer ? (
              (myPlayer.primaryRole || myPlayer.secondaryRole) && (
                <div className="auth-panel__popover-roles">
                  {myPlayer.primaryRole && <span className="auth-panel__role-tag">{myPlayer.primaryRole}</span>}
                  {myPlayer.secondaryRole && <span className="auth-panel__role-tag">{myPlayer.secondaryRole}</span>}
                </div>
              )
            ) : (
              <p className="auth-panel__popover-hint">
                Ton compte n'est encore relié à aucune fiche joueur — vois la page Disponibilités pour t'associer.
              </p>
            )}

            <Link to="/disponibilites" className="btn btn-ghost auth-panel__popover-link" onClick={() => setOpen(false)}>
              Mes disponibilités
            </Link>
            <button type="button" className="btn btn-ghost auth-panel__popover-link" onClick={handleSignOut}>
              Se déconnecter
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
