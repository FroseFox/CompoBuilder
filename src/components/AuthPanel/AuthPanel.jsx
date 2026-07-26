import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import './AuthPanel.css'

export default function AuthPanel() {
  const { user, isAdmin, signIn, signOut } = useAuth()
  const { pushToast } = useToast()
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (user) {
    return (
      <div className="auth-panel__status">
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

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    const error = await signIn(email, password)
    setSubmitting(false)
    if (error) {
      pushToast('Connexion refusée : email ou mot de passe incorrect.', 'error')
      return
    }
    pushToast('Connexion réussie.', 'success')
    setOpen(false)
    setPassword('')
  }

  return (
    <>
      <button className="btn btn-ghost" onClick={() => setOpen(true)}>
        Connexion admin
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="confirm-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={() => setOpen(false)}
          >
            <motion.form
              className="auth-panel__form glass-panel"
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              onSubmit={handleSubmit}
            >
              <h3>Connexion administrateur</h3>
              <p className="auth-panel__hint">
                Les autres membres de l'équipe n'ont pas besoin de compte : ils
                consultent les compositions sans se connecter.
              </p>

              <label className="player-form__field">
                <span>Email</span>
                <input
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@monequipe.com"
                />
              </label>

              <label className="player-form__field">
                <span>Mot de passe</span>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </label>

              <div className="confirm-dialog__actions">
                <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Connexion…' : 'Se connecter'}
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
