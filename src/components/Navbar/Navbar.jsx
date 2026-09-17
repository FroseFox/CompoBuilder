import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useTheme } from '../../context/ThemeContext'
import { useSound } from '../../context/SoundContext'
import { useAuth } from '../../context/AuthContext'
import { useCompositions } from '../../context/CompositionsContext'
import { useToast } from '../../context/ToastContext'
import { useEscapeToClose } from '../../hooks/useEscapeToClose'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import ConfirmDialog from '../ConfirmDialog/ConfirmDialog'
import GlobalSearch from '../GlobalSearch/GlobalSearch'
import AuthPanel from '../AuthPanel/AuthPanel'
import TeamSettingsModal from '../TeamSettingsModal/TeamSettingsModal'
import './Navbar.css'

// Onglets du quotidien, toujours visibles. Les autres (consultés plus
// ponctuellement) vivent sous le menu déroulant "Plus" — voir
// MORE_NAV_ITEMS et NavMoreMenu ci-dessous — pour ne pas surcharger la
// barre à mesure que le site gagne des pages. Même comportement en
// desktop (popover positionné sous le déclencheur) et en mobile (le
// popover s'ouvre par-dessus le reste du panneau déroulant) : un seul
// composant, pas de liste à plat dupliquée.
const PRIMARY_NAV_ITEMS = [
  { to: '/', label: 'Maps', icon: MapsIcon, end: true },
  { to: '/team', label: 'Équipe', icon: TeamIcon },
  { to: '/matchcenter', label: 'Match Center', icon: MatchIcon },
]

const MORE_NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: DashboardIcon },
  { to: '/stats', label: 'Statistiques', icon: StatsIcon },
  { to: '/disponibilites', label: 'Dispos', icon: ClockIcon },
]

export default function Navbar() {
  const { theme, toggleTheme } = useTheme()
  const { enabled: soundEnabled, toggleSound } = useSound()
  const { isAdmin } = useAuth()
  const { resetAll } = useCompositions()
  const { pushToast } = useToast()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

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

            <NavMoreMenu onNavigate={() => setMobileMenuOpen(false)} />

            <div className="topnav__mobile-actions">
              <button className="btn btn-ghost" onClick={toggleSound}>
                {soundEnabled ? 'Couper le son' : 'Activer le son'}
              </button>
              <button className="btn btn-ghost" onClick={toggleTheme}>
                {theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
              </button>
              {isAdmin && (
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    setSettingsOpen(true)
                    setMobileMenuOpen(false)
                  }}
                >
                  Réglages d'équipe
                </button>
              )}
              {isAdmin && (
                <button
                  className="btn btn-danger"
                  onClick={() => {
                    setConfirmOpen(true)
                    setMobileMenuOpen(false)
                  }}
                >
                  Réinitialiser tout
                </button>
              )}
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

            {isAdmin && (
              <button
                className="btn btn-ghost btn-icon topnav__icon-btn"
                onClick={() => setSettingsOpen(true)}
                aria-label="Réglages d'équipe"
                title="Réglages d'équipe (webhook Discord)"
              >
                <SettingsIcon />
              </button>
            )}

            {isAdmin && (
              <button className="btn btn-danger topnav__reset" onClick={() => setConfirmOpen(true)}>
                <span>Réinitialiser tout</span>
              </button>
            )}

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

      <TeamSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />

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

/**
 * Onglet "Plus" : regroupe les pages consultées plus ponctuellement
 * (Dashboard, Statistiques, Dispos) derrière un menu déroulant, pour ne
 * pas surcharger la barre de nav à plat — voir MORE_NAV_ITEMS. Reste
 * actif visuellement (barre d'accent) quand une des pages qu'il
 * regroupe est la page courante, même repliée.
 *
 * Deux présentations bien différentes selon l'espace disponible, pas
 * juste une histoire de position :
 * - Desktop : un vrai popover flottant, rendu via un portail dans
 *   document.body plutôt qu'à sa place naturelle — le bouton vit dans
 *   .topnav__links, qui a besoin d'un défilement horizontal
 *   (overflow-x: auto) pour les écrans étroits, or poser overflow-x sans
 *   overflow-y force ce dernier à 'auto' aussi (règle CSS peu connue),
 *   ce qui aurait découpé net un panneau positionné en absolute à
 *   l'intérieur. Le portail contourne le problème ; sa position
 *   (calculée depuis le bouton à l'ouverture) le fait à la place.
 * - Mobile : le panneau déroulant plein écran est déjà une liste
 *   verticale en flux normal — un popover flottant par-dessus y
 *   chevaucherait les boutons juste en dessous (son/thème/réglages).
 *   Les 3 liens s'insèrent donc simplement en accordéon, dans le flux,
 *   juste sous "Plus" : ils poussent le reste vers le bas au lieu de
 *   le recouvrir.
 */
function NavMoreMenu({ onNavigate }) {
  const location = useLocation()
  const isMobile = useMediaQuery('(max-width: 980px)')
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState(null)
  const triggerRef = useRef(null)
  const popoverRef = useRef(null)

  useEscapeToClose(open, () => setOpen(false))

  // Clic en dehors : sur desktop, le déclencheur ET le panneau (rendus
  // dans deux sous-arbres DOM différents à cause du portail) comptent
  // tous les deux comme "dedans" — useClickOutside seul ne connaît
  // qu'une ref. Sur mobile (pas de portail, panneau en flux normal),
  // triggerRef seul suffirait déjà, mais cette version marche pour les deux.
  useEffect(() => {
    if (!open) return undefined
    const handlePointerDown = (e) => {
      if (triggerRef.current?.contains(e.target)) return
      if (popoverRef.current?.contains(e.target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [open])

  // Referme au changement mobile/desktop (plus simple qu'un recalcul
  // fidèle de la position du popover desktop) pendant que c'est ouvert.
  useEffect(() => {
    if (!open) return undefined
    const handleResize = () => setOpen(false)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [open])

  const isActive = MORE_NAV_ITEMS.some((item) => location.pathname === item.to)

  const handleToggle = () => {
    if (!open && !isMobile && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      const popoverWidth = 190
      setCoords({
        top: rect.bottom + 8,
        left: Math.min(rect.left, window.innerWidth - popoverWidth - 8),
      })
    }
    setOpen((o) => !o)
  }

  const handleNavigate = () => {
    setOpen(false)
    onNavigate?.()
  }

  const links = (linkClassName) =>
    MORE_NAV_ITEMS.map(({ to, label, icon: Icon }) => (
      <NavLink
        key={to}
        to={to}
        className={({ isActive: linkActive }) => `${linkClassName} ${linkActive ? 'topnav__more-link--active' : ''}`}
        onClick={handleNavigate}
      >
        <Icon />
        <span>{label}</span>
      </NavLink>
    ))

  return (
    <div className="topnav__more">
      <button
        type="button"
        ref={triggerRef}
        className={`topnav__link topnav__more-trigger ${isActive ? 'topnav__link--active' : ''}`}
        onClick={handleToggle}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <span className="topnav__link-content">
          <MoreIcon />
          <span>Plus</span>
          <ChevronIcon className={`topnav__more-chevron ${open ? 'topnav__more-chevron--open' : ''}`} />
        </span>
        {isActive && (
          <motion.span
            className="topnav__link-bar"
            layoutId="topnav-active-bar"
            transition={{ type: 'spring', stiffness: 500, damping: 40 }}
          />
        )}
      </button>

      {isMobile ? (
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              ref={popoverRef}
              className="topnav__more-inline"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.14, ease: 'easeOut' }}
            >
              {links('topnav__more-link topnav__more-link--inline')}
            </motion.div>
          )}
        </AnimatePresence>
      ) : (
        createPortal(
          <AnimatePresence>
            {open && coords && (
              <motion.div
                ref={popoverRef}
                className="topnav__more-popover glass-panel"
                style={{ top: coords.top, left: coords.left }}
                initial={{ opacity: 0, y: -8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 420, damping: 30 } }}
                exit={{ opacity: 0, y: -6, scale: 0.98, transition: { duration: 0.12 } }}
              >
                {links('topnav__more-link')}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )
      )}
    </div>
  )
}

function MoreIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="5" cy="12" r="1.6" fill="currentColor" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" />
      <circle cx="19" cy="12" r="1.6" fill="currentColor" />
    </svg>
  )
}

function ChevronIcon({ className }) {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" className={className}>
      <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
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
function MatchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M4 5h16v10H4z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M9 19h6M12 15v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}
function StatsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M4 20V10M12 20V4M20 20v-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 7v5.5l3.8 2.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M19.4 13.5a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V19.5a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H4.5a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H10a1.65 1.65 0 0 0 1-1.51V4.5a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V10c.36.62 1 1 1.51 1H19.5a2 2 0 1 1 0 4h-.09c-.62 0-1.15.38-1.51 1Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
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
