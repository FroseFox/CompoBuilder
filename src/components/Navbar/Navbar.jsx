import { useEffect, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useTheme } from '../../context/ThemeContext'
import { useAuth } from '../../context/AuthContext'
import { useCompositions } from '../../context/CompositionsContext'
import { useToast } from '../../context/ToastContext'
import ConfirmDialog from '../ConfirmDialog/ConfirmDialog'
import GlobalSearch from '../GlobalSearch/GlobalSearch'
import AuthPanel from '../AuthPanel/AuthPanel'
import './Navbar.css'

export default function Navbar() {
  const { theme, toggleTheme } = useTheme()
  const { isAdmin } = useAuth()
  const { resetAll } = useCompositions()
  const { pushToast } = useToast()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  const handleResetAll = async () => {
    await resetAll()
    setConfirmOpen(false)
    pushToast('Toutes les compositions ont été réinitialisées.', 'success')
  }

  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <>
      <header className="navbar">
        <div className="container navbar__inner">
          <Link to="/" className="navbar__brand">
            <span className="navbar__mark" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M12 3v6M12 15v6M3 12h6M15 12h6" stroke="currentColor" strokeWidth="2.4" />
                <rect x="10.5" y="10.5" width="3" height="3" fill="currentColor" />
              </svg>
            </span>
            <span className="navbar__title">
              COMP<span className="navbar__title-accent">BUILDER</span>
            </span>
          </Link>

          <nav className="navbar__links">
            <NavLink to="/" end className={({ isActive }) => `navbar__link ${isActive ? 'navbar__link--active' : ''}`}>
              Maps
            </NavLink>
            <NavLink to="/team" className={({ isActive }) => `navbar__link ${isActive ? 'navbar__link--active' : ''}`}>
              Équipe
            </NavLink>
            <NavLink to="/dashboard" className={({ isActive }) => `navbar__link ${isActive ? 'navbar__link--active' : ''}`}>
              Dashboard
            </NavLink>
          </nav>

          <div className="navbar__actions">
            <button
              className="btn btn-ghost navbar__search-trigger"
              onClick={() => setSearchOpen(true)}
              aria-label="Recherche globale"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <span>Rechercher</span>
              <kbd>⌘K</kbd>
            </button>

            <button
              className="btn btn-ghost btn-icon"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Activer le mode clair' : 'Activer le mode sombre'}
              title={theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
            >
              {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </button>

            {isAdmin && (
              <button className="btn btn-danger" onClick={() => setConfirmOpen(true)}>
                <span>Réinitialiser tout</span>
              </button>
            )}

            <AuthPanel />
          </div>
        </div>
      </header>

      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />

      <ConfirmDialog
        open={confirmOpen}
        title="Réinitialiser toutes les compositions ?"
        description="Toutes les compositions enregistrées, pour toutes les maps, seront définitivement supprimées. L'effectif de joueurs n'est pas affecté. Cette action est irréversible."
        confirmLabel="Tout réinitialiser"
        onConfirm={handleResetAll}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  )
}

function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 2v2.4M12 19.6V22M4.9 4.9l1.7 1.7M17.4 17.4l1.7 1.7M2 12h2.4M19.6 12H22M4.9 19.1l1.7-1.7M17.4 6.6l1.7-1.7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M20 14.2A8.2 8.2 0 1 1 9.8 4a6.6 6.6 0 0 0 10.2 10.2Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  )
}
