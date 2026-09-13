import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useData } from '../../context/DataContext'
import { useCompositions } from '../../context/CompositionsContext'
import { useAuth } from '../../context/AuthContext'
import { computeDashboardStats, getCompsForMap } from '../../utils/compositions'
import { STATUS, STATUS_META } from '../../utils/storage'
import ProgressBar from '../../components/ProgressBar/ProgressBar'
import Loader from '../../components/Loader/Loader'
import './Dashboard.css'

const STAT_ICON = {
  totalMaps: MapsGlyph,
  totalCompositions: LayersGlyph,
  validated: CheckGlyph,
  testing: FlaskGlyph,
  needs_work: WrenchGlyph,
  todo: ListGlyph,
  empty: EmptyGlyph,
}

export default function Dashboard() {
  const { maps, status } = useData()
  const { compositionsByMap } = useCompositions()
  const { profile } = useAuth() || {}

  const stats = useMemo(
    () => computeDashboardStats(compositionsByMap, maps),
    [compositionsByMap, maps]
  )

  const mapsByBucket = useMemo(() => {
    const buckets = { [STATUS.TESTING]: [], [STATUS.NEEDS_WORK]: [], [STATUS.TODO]: [], empty: [] }
    maps.forEach((map) => {
      const comps = getCompsForMap(compositionsByMap, map.uuid)
      if (comps.length === 0) {
        buckets.empty.push(map)
        return
      }
      const main = comps.find((c) => c.isMain) || comps[0]
      if (main.status === STATUS.TESTING) buckets[STATUS.TESTING].push(map)
      if (main.status === STATUS.NEEDS_WORK) buckets[STATUS.NEEDS_WORK].push(map)
      if (main.status === STATUS.TODO) buckets[STATUS.TODO].push(map)
    })
    return buckets
  }, [maps, compositionsByMap])

  if (status === 'loading') {
    return (
      <main className="container">
        <Loader label="Chargement du tableau de bord…" />
      </main>
    )
  }

  return (
    <main className="dashboard container">
      <div className="dashboard__header">
        <span className="eyebrow dashboard__eyebrow">Vue d'ensemble</span>
        <h1 className="dashboard__title">
          Bonjour{profile?.displayName ? ` ${profile.displayName}` : ''} <span aria-hidden="true">👋</span>
        </h1>
        <p>L'état de préparation de votre équipe, map par map.</p>
      </div>

      <div className="dashboard__hero">
        <motion.section
          className="dashboard__hero-progress"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className="panel-eyebrow">Progression globale</span>
          <div className="dashboard__hero-value">{stats.progressPercent}%</div>
          <ProgressBar percent={stats.progressPercent} />
          <p className="dashboard__hero-caption">
            {stats.validated} map(s) terminée(s) sur {stats.totalMaps}.
          </p>
        </motion.section>

        <motion.aside
          className="dashboard__hero-side"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className="panel-eyebrow">Répartition</span>
          <ul className="dashboard__hero-side-list">
            <li>
              <span className="dot dot--validated" /> Terminées <b>{stats.validated}</b>
            </li>
            <li>
              <span className="dot dot--testing" /> En test <b>{stats.testing}</b>
            </li>
            <li>
              <span className="dot dot--needs_work" /> À retravailler <b>{stats.needsWork}</b>
            </li>
            <li>
              <span className="dot dot--todo" /> À faire <b>{stats.todo}</b>
            </li>
          </ul>
        </motion.aside>
      </div>

      <div className="dashboard__stat-grid">
        <StatCard index={0} icon="totalMaps" value={stats.totalMaps} label="Maps au total" />
        <StatCard index={1} icon="totalCompositions" value={stats.totalCompositions} label="Compositions créées" />
        <StatCard index={2} icon="validated" value={stats.validated} label="Maps terminées" tone="validated" />
        <StatCard index={3} icon="testing" value={stats.testing} label="Maps en test" tone="testing" />
        <StatCard index={4} icon="needs_work" value={stats.needsWork} label="À retravailler" tone="needs_work" />
        <StatCard index={5} icon="todo" value={stats.todo} label="À faire" tone="todo" />
        <StatCard index={6} icon="empty" value={stats.empty} label="Maps vides" tone="empty" />
      </div>

      <div className="dashboard__lists">
        <MapBucketList
          index={0}
          title="À retravailler"
          emoji={STATUS_META[STATUS.NEEDS_WORK].emoji}
          maps={mapsByBucket[STATUS.NEEDS_WORK]}
        />
        <MapBucketList
          index={1}
          title="En test"
          emoji={STATUS_META[STATUS.TESTING].emoji}
          maps={mapsByBucket[STATUS.TESTING]}
        />
        <MapBucketList
          index={2}
          title="À faire"
          emoji={STATUS_META[STATUS.TODO].emoji}
          maps={mapsByBucket[STATUS.TODO]}
        />
        <MapBucketList index={3} title="Sans composition" emoji="⬜" maps={mapsByBucket.empty} />
      </div>
    </main>
  )
}

function StatCard({ value, label, tone, icon, index = 0 }) {
  const Icon = STAT_ICON[icon] || MapsGlyph
  return (
    <motion.div
      className={`stat-card ${tone ? `stat-card--${tone}` : ''}`}
      initial={{ opacity: 0, y: 12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] }}
    >
      <span className="stat-card__icon">
        <Icon />
      </span>
      <span className="stat-card__value">{value}</span>
      <span className="stat-card__label">{label}</span>
    </motion.div>
  )
}

function MapBucketList({ title, emoji, maps, index = 0 }) {
  return (
    <motion.div
      className="dashboard__bucket glass-panel"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, delay: 0.15 + index * 0.06, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="dashboard__bucket-header">
        <h3>
          <span aria-hidden="true">{emoji}</span> {title}
        </h3>
        <span className="dashboard__bucket-count">{maps.length}</span>
      </div>
      {maps.length === 0 ? (
        <p className="dashboard__bucket-empty">Aucune map ici — bien joué.</p>
      ) : (
        <ul>
          {maps.map((m) => (
            <li key={m.uuid}>
              <Link to={`/editor/${m.uuid}`}>{m.name}</Link>
            </li>
          ))}
        </ul>
      )}
    </motion.div>
  )
}

function MapsGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M9 4 3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5 9 4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  )
}
function LayersGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="m12 3 9 5-9 5-9-5 9-5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="m3 12 9 5 9-5M3 16.5l9 5 9-5" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  )
}
function CheckGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M4 12.5 9.5 18 20 6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function FlaskGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M9 3h6M10 3v6.5L4.5 19a1.5 1.5 0 0 0 1.3 2.3h12.4a1.5 1.5 0 0 0 1.3-2.3L14 9.5V3" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  )
}
function WrenchGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M14.7 6.3a4 4 0 0 1-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 1 5.4-5.4l-3 3-2-2 3-3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  )
}
function ListGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
function EmptyGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <rect x="4" y="4" width="16" height="16" rx="3" stroke="currentColor" strokeWidth="1.8" strokeDasharray="3 3" />
    </svg>
  )
}
