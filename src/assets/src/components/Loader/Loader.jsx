import './Loader.css'

export default function Loader({ label = 'Chargement…' }) {
  return (
    <div className="loader" role="status" aria-live="polite">
      <span className="loader__ring" aria-hidden="true" />
      <span className="loader__label">{label}</span>
    </div>
  )
}
