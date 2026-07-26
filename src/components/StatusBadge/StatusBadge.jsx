import { STATUS, STATUS_META } from '../../utils/storage'
import './StatusBadge.css'

/** Mode lecture seule : simple pastille. */
export function StatusDot({ status, size = 'md' }) {
  const meta = STATUS_META[status]
  if (!meta) return null
  return (
    <span className={`status-dot status-dot--${size}`} style={{ '--status-color': meta.color }} title={meta.label}>
      <span className="status-dot__glow" />
      {meta.label}
    </span>
  )
}

/** Mode édition : sélecteur segmenté des 3 statuts. */
export default function StatusPicker({ value, onChange }) {
  return (
    <div className="status-picker" role="radiogroup" aria-label="Statut de la composition">
      {Object.values(STATUS).map((status) => {
        const meta = STATUS_META[status]
        const active = value === status
        return (
          <button
            key={status}
            type="button"
            role="radio"
            aria-checked={active}
            className={`status-picker__opt ${active ? 'status-picker__opt--active' : ''}`}
            style={{ '--status-color': meta.color }}
            onClick={() => onChange(status)}
          >
            <span className="status-picker__dot" />
            {meta.label}
          </button>
        )
      })}
    </div>
  )
}
