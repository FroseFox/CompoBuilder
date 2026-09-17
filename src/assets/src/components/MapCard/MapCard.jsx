import { useState } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { StatusDot } from '../StatusBadge/StatusBadge'
import PlayerAvatar from '../PlayerAvatar/PlayerAvatar'
import { formatRelativeDate } from '../../utils/compositions'
import { STATUS_META } from '../../utils/storage'
import './MapCard.css'

export default function MapCard({ map, summary, players, index = 0 }) {
  const { filledCount, status, lastModified, compsCount, mainComp } = summary
  const isComplete = filledCount === 5
  const [loaded, setLoaded] = useState(false)
  const accentColor = STATUS_META[status]?.color || 'var(--text-tertiary)'

  const assignedPlayers = mainComp
    ? mainComp.slots
        .map((s) => (s.playerId ? players[s.playerId] : null))
        .filter(Boolean)
    : []

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.04, 0.4), ease: [0.16, 1, 0.3, 1] }}
    >
      <Link
        to={`/editor/${map.uuid}`}
        className="map-card glass-panel accent-card"
        style={{ '--accent-card-color': accentColor }}
      >
        <div className="map-card__image-wrap">
          {/* Fond flouté immédiat à partir de la petite vignette (déjà en
              cache la plupart du temps), pendant que l'image nette pleine
              qualité (splash) charge par-dessus puis apparaît en fondu —
              net et rapide à l'affichage, plutôt que net-mais-lent ou
              rapide-mais-flou. */}
          <div
            className="map-card__image-placeholder"
            style={{ backgroundImage: `url(${map.thumbnail})` }}
            aria-hidden="true"
          />
          <img
            src={map.image}
            alt=""
            loading="lazy"
            decoding="async"
            className={`map-card__image ${loaded ? 'map-card__image--loaded' : ''}`}
            onLoad={() => setLoaded(true)}
          />
          <div className="map-card__scrim" />
          <span className={`map-card__count ${isComplete ? 'map-card__count--full' : ''}`}>
            {filledCount}/5
          </span>
          {compsCount > 1 && <span className="map-card__comps-count">{compsCount} compositions</span>}
        </div>

        <div className="map-card__body">
          <div className="map-card__top-row">
            <h3 className="map-card__name">{map.name}</h3>
            {status && <StatusDot status={status} size="sm" />}
          </div>

          <div className="map-card__bottom-row">
            <div className="map-card__players">
              {assignedPlayers.length > 0 ? (
                assignedPlayers
                  .slice(0, 5)
                  .map((p, i) => <PlayerAvatar key={p.id + i} player={p} size="sm" />)
              ) : (
                <span className="map-card__no-players">Aucun joueur assigné</span>
              )}
            </div>
            <span className="map-card__updated">{formatRelativeDate(lastModified)}</span>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}
