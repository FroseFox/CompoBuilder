import './Skeleton.css'

export function MapCardSkeleton() {
  return (
    <div className="skeleton skeleton-map-card">
      <div className="skeleton-shimmer skeleton-map-card__image" />
      <div className="skeleton-map-card__body">
        <div className="skeleton-shimmer skeleton-line" style={{ width: '60%' }} />
        <div className="skeleton-shimmer skeleton-line" style={{ width: '35%' }} />
      </div>
    </div>
  )
}

export function AgentCardSkeleton() {
  return (
    <div className="skeleton skeleton-agent-card">
      <div className="skeleton-shimmer skeleton-agent-card__portrait" />
      <div className="skeleton-shimmer skeleton-line" style={{ width: '70%' }} />
    </div>
  )
}

export function MapCardSkeletonGrid({ count = 8 }) {
  return (
    <div className="skeleton-grid">
      {Array.from({ length: count }).map((_, i) => (
        <MapCardSkeleton key={i} />
      ))}
    </div>
  )
}
