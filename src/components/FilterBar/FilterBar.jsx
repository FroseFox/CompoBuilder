import './FilterBar.css'

export const FILTERS = {
  ALL: 'all',
  WITH: 'with',
  WITHOUT: 'without',
}

export const SORTS = {
  ALPHA: 'alpha',
  RECENT: 'recent',
  COMPLETE_FIRST: 'complete_first',
  INCOMPLETE_FIRST: 'incomplete_first',
}

const FILTER_LABELS = {
  [FILTERS.ALL]: 'Toutes les maps',
  [FILTERS.WITH]: 'Avec composition',
  [FILTERS.WITHOUT]: 'Sans composition',
}

const SORT_LABELS = {
  [SORTS.ALPHA]: 'Ordre alphabétique',
  [SORTS.RECENT]: 'Dernière modification',
  [SORTS.COMPLETE_FIRST]: 'Terminées en premier',
  [SORTS.INCOMPLETE_FIRST]: 'Non terminées en premier',
}

export default function FilterBar({ search, onSearchChange, filter, onFilterChange, sort, onSortChange }) {
  return (
    <div className="filter-bar">
      <div className="filter-bar__search">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
          <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input
          type="text"
          placeholder="Rechercher une map…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          aria-label="Rechercher une map"
        />
        {search && (
          <button className="filter-bar__clear" onClick={() => onSearchChange('')} aria-label="Effacer la recherche">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>

      <div className="filter-bar__chips" role="group" aria-label="Filtrer les maps">
        {Object.values(FILTERS).map((f) => (
          <button
            key={f}
            className={`filter-chip ${filter === f ? 'filter-chip--active' : ''}`}
            onClick={() => onFilterChange(f)}
          >
            {FILTER_LABELS[f]}
          </button>
        ))}
      </div>

      <select
        className="filter-bar__sort"
        value={sort}
        onChange={(e) => onSortChange(e.target.value)}
        aria-label="Trier les maps"
      >
        {Object.values(SORTS).map((s) => (
          <option key={s} value={s}>
            {SORT_LABELS[s]}
          </option>
        ))}
      </select>
    </div>
  )
}
