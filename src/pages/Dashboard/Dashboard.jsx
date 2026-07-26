import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../../context/DataContext'
import { useCompositions } from '../../context/CompositionsContext'
import { computeDashboardStats, getCompsForMap } from '../../utils/compositions'
import { STATUS, STATUS_META } from '../../utils/storage'
import ProgressBar from '../../components/ProgressBar/ProgressBar'
import Loader from '../../components/Loader/Loader'
import './Dashboard.css'

export default function Dashboard() {
  const { maps, status } = useData()
  const { compositionsByMap } = useCompositions()

  const stats = useMemo(
    () => computeDashboardStats(compositionsByMap, maps),
    [compositionsByMap, maps]
  )

  const mapsByBucket = useMemo(() => {
    const buckets = { [STATUS.TESTING]: [], [STATUS.NEEDS_WORK]: [], empty: [] }
    maps.forEach((map) => {
      const comps = getCompsForMap(compositionsByMap, map.uuid)
      if (comps.length === 0) {
        buckets.empty.push(map)
        return
      }
      const main = comps.find((c) => c.isMain) || comps[0]
      if (main.status === STATUS.TESTING) buckets[STATUS.TESTING].push(map)
      if (main.status === STATUS.NEEDS_WORK) buckets[STATUS.NEEDS_WORK].push(map)
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
        <span className="home__eyebrow">Vue d'ensemble</span>
        <h1 className="dashboard__title">Tableau de bord</h1>
        <p>L'état de préparation de votre équipe, map par map.</p>
      </div>

      <div className="dashboard__stat-grid">
        <StatCard value={stats.totalMaps} label="Maps au total" />
        <StatCard value={stats.totalCompositions} label="Compositions créées" />
        <StatCard value={stats.validated} label="Maps terminées" tone="validated" />
        <StatCard value={stats.testing} label="Maps en test" tone="testing" />
        <StatCard value={stats.needsWork} label="À retravailler" tone="needs_work" />
        <StatCard value={stats.empty} label="Maps vides" tone="empty" />
      </div>

      <section className="dashboard__progress-section glass-panel">
        <ProgressBar
          percent={stats.progressPercent}
          label={
            <>
              <span>Progression globale</span>
              <span>{stats.progressPercent}%</span>
            </>
          }
        />
        <p className="dashboard__progress-caption">
          {stats.validated} map(s) terminée(s) sur {stats.totalMaps}.
        </p>
      </section>

      <div className="dashboard__lists">
        <MapBucketList
          title="À retravailler"
          emoji={STATUS_META[STATUS.NEEDS_WORK].emoji}
          maps={mapsByBucket[STATUS.NEEDS_WORK]}
        />
        <MapBucketList
          title="En test"
          emoji={STATUS_META[STATUS.TESTING].emoji}
          maps={mapsByBucket[STATUS.TESTING]}
        />
        <MapBucketList title="Sans composition" emoji="⬜" maps={mapsByBucket.empty} />
      </div>
    </main>
  )
}

function StatCard({ value, label, tone }) {
  return (
    <div className={`stat-card ${tone ? `stat-card--${tone}` : ''}`}>
      <span className="stat-card__value">{value}</span>
      <span className="stat-card__label">{label}</span>
    </div>
  )
}

function MapBucketList({ title, emoji, maps }) {
  return (
    <div className="dashboard__bucket glass-panel">
      <h3>
        {emoji} {title} <span className="dashboard__bucket-count">{maps.length}</span>
      </h3>
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
    </div>
  )
}
