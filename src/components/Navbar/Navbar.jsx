import { useEffect, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useTheme } from '../../context/ThemeContext'
import { useSound } from '../../context/SoundContext'
import { useAuth } from '../../context/AuthContext'
import GlobalSearch from '../GlobalSearch/GlobalSearch'
import AuthPanel from '../AuthPanel/AuthPanel'
import { networkUrl } from '../../services/team'
import './Navbar.css'

// Le Comp Builder ne garde que ce qui sert aux compos : les maps, l'effectif
// pour assigner les joueurs, et l'avancement. Scrims, classement et stats
// vivent sur le site du réseau.
const PRIMARY_NAV_ITEMS = [
  { to: '/', label: 'Maps', icon: MapsIcon, end: true },
  { to: '/team', label: 'Équipe', icon: TeamIcon },
  { to: '/dashboard', label: 'Avancement', icon: DashboardIcon },
]

export default function Navbar() {
  const { theme, toggleTheme } = useTheme()
  const { enabled: soundEnabled, toggleSound } = useSound()
  const { team } = useAuth()
  const [searchOpen, setSearchOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

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
      <header className="topnav">
        <div className="topnav__row">
          <Link to="/" className="topnav__brand">
            <span className="topnav__mark cut-corner-sm" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M12 3v6M12 15v6M3 12h6M15 12h6" stroke="currentColor" strokeWidth="2.4" />
                <rect x="10.5" y="10.5" width="3" height="3" fill="currentColor" />
              </svg>
            </span>
            <span className="topnav__title">
              COMP<span className="topnav__title-accent">BUILDER</span>
            </span>
            {team && (
              <span className="topnav__team" title={team.name}>
                {team.logo_url ? <img src={team.logo_url} alt="" width="18" height="18" /> : null}
                {team.tag}
              </span>
            )}
          </Link>

          <nav className={`topnav__links ${mobileMenuOpen ? 'topnav__links--open' : ''}`}>
            {PRIMARY_NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) => `topnav__link ${isActive ? 'topnav__link--active' : ''}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                {({ isActive }) => (
                  <>
                    <span className="topnav__link-content">
                      <Icon />
                      <span>{label}</span>
                    </span>
                    {isActive && (
                      <motion.span
                        className="topnav__link-bar"
                        layoutId="topnav-active-bar"
                        transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                      />
                    )}
                  </>
                )}
              </NavLink>
            ))}

            <div className="topnav__mobile-actions">
              <a className="btn btn-ghost" href={networkUrl('#/espace')}>
                ← Espace équipe du réseau
              </a>
              <button className="btn btn-ghost" onClick={toggleSound}>
                {soundEnabled ? 'Couper le son' : 'Activer le son'}
              </button>
              <button className="btn btn-ghost" onClick={toggleTheme}>
                {theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
              </button>
              <AuthPanel />
            </div>
          </nav>

          <div className="topnav__actions">
            <button
              type="button"
              className="topnav__search-trigger"
              onClick={() => setSearchOpen(true)}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <span>Rechercher</span>
              <kbd>⌘K</kbd>
            </button>

            <button
              className="btn btn-ghost btn-icon topnav__icon-btn"
              onClick={toggleSound}
              aria-label={soundEnabled ? 'Couper le son' : 'Activer le son'}
              title={soundEnabled ? 'Couper le son' : 'Activer le son'}
            >
              {soundEnabled ? <SoundOnIcon /> : <SoundOffIcon />}
            </button>

            <button
              className="btn btn-ghost btn-icon topnav__icon-btn"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Activer le mode clair' : 'Activer le mode sombre'}
              title={theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
            >
              {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </button>

            <a
              className="btn btn-ghost topnav__network"
              href={networkUrl('#/espace')}
              title="Retour à l'espace équipe du PRIZM Competitive Network"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>Réseau</span>
            </a>

            <AuthPanel />

            <button
              type="button"
              className="topnav__hamburger"
              onClick={() => setMobileMenuOpen((o) => !o)}
              aria-label={mobileMenuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </header>

      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />

    </>
  )
}

function MapsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M9 4 3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5 9 4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M9 4v13M15 6.5v13" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  )
}
function TeamIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="9" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M16 4.3a3.2 3.2 0 0 1 0 6.2M21 20c0-2.8-2-5.1-4.7-5.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}
function DashboardIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.6" stroke="currentColor" strokeWidth="1.8" />
      <rect x="13" y="3.5" width="7.5" height="4.5" rx="1.6" stroke="currentColor" strokeWidth="1.8" />
      <rect x="13" y="11" width="7.5" height="9.5" rx="1.6" stroke="currentColor" strokeWidth="1.8" />
      <rect x="3.5" y="14" width="7.5" height="6.5" rx="1.6" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  )
}
function SoundOnIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M4 10v4h3.5L12 17.5v-11L7.5 10H4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M16 9a4.2 4.2 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function SoundOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M4 10v4h3.5L12 17.5v-11L7.5 10H4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="m16 9.5 4.5 5M20.5 9.5 16 14.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
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
