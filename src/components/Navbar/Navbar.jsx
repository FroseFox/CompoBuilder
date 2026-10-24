import { useEffect, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import GlobalSearch from '../GlobalSearch/GlobalSearch'
import AuthPanel from '../AuthPanel/AuthPanel'
import { networkUrl } from '../../services/team'
import './Navbar.css'

// Le Comp Builder ne garde que ce qui sert aux compos : les maps, l'effectif
// pour assigner les joueurs, et l'avancement. Scrims, classement et stats
// vivent sur le site du réseau.
const TABS = [
  { to: '/', label: 'Maps', end: true },
  { to: '/team', label: 'Équipe' },
  { to: '/dashboard', label: 'Avancement' },
]

const NETWORK_LINKS = [
  ['#/espace', 'Mon espace'],
  ['#/scrims', 'Scrims'],
  ['#/recherche', 'Recherche'],
  ['#/classement', 'Classement'],
  ['#/equipes', 'Équipes'],
  ['#reglement', 'Règlement'],
]

export default function Navbar() {
  const { team } = useAuth()
  const [searchOpen, setSearchOpen] = useState(false)

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

  // Même en-tête que le site du réseau : on reste « chez PRIZM »
  return (
    <>
      <header className="pz-top">
        <div className="pz-wrap pz-top__row">
          <a href={networkUrl('#/reseau')} className="pz-top__brand" aria-label="PRIZM Competitive Network, accueil du réseau">
            <img src="../logo.png" alt="PRIZM Competitive Network" />
          </a>
          <nav className="pz-top__nav" aria-label="Competitive Network">
            {NETWORK_LINKS.map(([hash, label]) => (
              <a key={hash} href={networkUrl(hash)} className={hash === '#/espace' ? 'on' : ''}>
                {label}
              </a>
            ))}
          </nav>
          <AuthPanel />
        </div>
      </header>

      <section className="pz-band">
        <div className="pz-wrap pz-band__inner">
          <span className="pz-eyebrow">Espace équipe{team ? ` · ${team.name}` : ''}</span>
          <div className="pz-band__title-row">
            <Link to="/" className="pz-band__title">Comp Builder</Link>
            <button type="button" className="pz-search" onClick={() => setSearchOpen(true)}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <span>Rechercher</span>
              <kbd>⌘K</kbd>
            </button>
          </div>
          <nav className="pz-tabs" aria-label="Comp Builder">
            {TABS.map(({ to, label, end }) => (
              <NavLink key={to} to={to} end={end} className={({ isActive }) => `pz-tab${isActive ? ' on' : ''}`}>
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </section>

      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  )
}
