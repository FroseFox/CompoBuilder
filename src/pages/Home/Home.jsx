import { useMemo, useState } from 'react'
import { useData } from '../../context/DataContext'
import { useCompositions } from '../../context/CompositionsContext'
import { usePlayers } from '../../context/PlayersContext'
import { summarizeMap } from '../../utils/compositions'
import MapCard from '../../components/MapCard/MapCard'
import { MapCardSkeletonGrid } from '../../components/Skeleton/Skeleton'
import FilterBar, { FILTERS, SORTS } from '../../components/FilterBar/FilterBar'
import './Home.css'

export default function Home() {
  const { maps, status, error, reload } = useData()
  const { compositionsByMap } = useCompositions()
  const { players } = usePlayers()

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState(FILTERS.ALL)
  const [sort, setSort] = useState(SORTS.ALPHA)

  // Résumé (comptage, statut, joueurs, date) calculé une seule fois par
  // rendu pour toutes les maps, réutilisé par le filtre, le tri et les cartes.
  const summaries = useMemo(() => {
    const map = new Map()
    maps.forEach((m) => map.set(m.uuid, summarizeMap(compositionsByMap, m.uuid)))
    return map
  }, [maps, compositionsByMap])

  const visibleMaps = useMemo(() => {
    let list = maps.filter((m) => m.name.toLowerCase().includes(search.trim().toLowerCase()))

    if (filter === FILTERS.WITH) {
      list = list.filter((m) => summaries.get(m.uuid).hasProgress)
    } else if (filter === FILTERS.WITHOUT) {
      list = list.filter((m) => !summaries.get(m.uuid).hasProgress)
    }

    const withSummary = list.map((m) => ({ map: m, summary: summaries.get(m.uuid) }))

    withSummary.sort((a, b) => {
      switch (sort) {
        case SORTS.RECENT:
          return (b.summary.lastModified || 0) - (a.summary.lastModified || 0)
        case SORTS.COMPLETE_FIRST:
          return b.summary.filledCount - a.summary.filledCount || a.map.name.localeCompare(b.map.name)
        case SORTS.INCOMPLETE_FIRST:
          return a.summary.filledCount - b.summary.filledCount || a.map.name.localeCompare(b.map.name)
        case SORTS.ALPHA:
        default:
          return a.map.name.localeCompare(b.map.name)
      }
    })

    return withSummary
  }, [maps, summaries, search, filter, sort])

  const totalComplete = maps.filter((m) => summaries.get(m.uuid)?.filledCount === 5).length

  return (
    <main className="home">
      <section className="home__hero container">
        <span className="home__eyebrow">Préparation d'équipe</span>
        <h1 className="home__title">
          Vos <span className="home__title-accent">compositions</span>, prêtes
          pour chaque match.
        </h1>
        <p className="home__subtitle">
          Retrouvez en un coup d'œil vos compositions par map, leur statut et
          les joueurs assignés — le tout sauvegardé automatiquement, en local.
        </p>
        {status === 'ready' && maps.length > 0 && (
          <div className="home__progress">
            <span className="home__progress-value">{totalComplete}</span>
            <span className="home__progress-label">
              / {maps.length} maps avec une composition complète
            </span>
          </div>
        )}
      </section>

      <section className="home__grid-section container">
        {status === 'loading' && <MapCardSkeletonGrid count={8} />}

        {status === 'error' && (
          <div className="home__error glass-panel">
            <h3>Impossible de charger les maps</h3>
            <p>{error}</p>
            <button className="btn btn-primary" onClick={reload}>
              Réessayer
            </button>
          </div>
        )}

        {status === 'ready' && (
          <>
            <FilterBar
              search={search}
              onSearchChange={setSearch}
              filter={filter}
              onFilterChange={setFilter}
              sort={sort}
              onSortChange={setSort}
            />

            {visibleMaps.length === 0 ? (
              <div className="home__empty glass-panel">
                <p>Aucune map ne correspond à ces critères.</p>
              </div>
            ) : (
              <div className="home__grid">
                {visibleMaps.map(({ map, summary }, index) => (
                  <MapCard key={map.uuid} map={map} summary={summary} players={players} index={index} />
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </main>
  )
}
