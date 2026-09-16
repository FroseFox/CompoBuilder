import { Fragment, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePlayers } from '../../context/PlayersContext'
import { useAvailability } from '../../context/AvailabilityContext'
import PlayerAvatar from '../../components/PlayerAvatar/PlayerAvatar'
import Loader from '../../components/Loader/Loader'
import './Availability.css'

const DAYS = [
  { day: 0, label: 'Lundi', short: 'Lun' },
  { day: 1, label: 'Mardi', short: 'Mar' },
  { day: 2, label: 'Mercredi', short: 'Mer' },
  { day: 3, label: 'Jeudi', short: 'Jeu' },
  { day: 4, label: 'Vendredi', short: 'Ven' },
  { day: 5, label: 'Samedi', short: 'Sam' },
  { day: 6, label: 'Dimanche', short: 'Dim' },
]

const PERIODS = [
  { period: 'morning', label: 'Matin' },
  { period: 'afternoon', label: 'Après-midi' },
  { period: 'evening', label: 'Soir' },
]

function cellKey(day, period) {
  return `${day}-${period}`
}

function describeCell(key) {
  const [dayStr, period] = key.split('-')
  const day = DAYS.find((d) => String(d.day) === dayStr)
  const periodMeta = PERIODS.find((p) => p.period === period)
  return `${day?.label ?? ''} · ${periodMeta?.label ?? ''}`
}

export default function Availability() {
  const { players, status: playersStatus } = usePlayers()
  const { slots, status: availabilityStatus, toggleSlot } = useAvailability()
  const [selectedPlayerId, setSelectedPlayerId] = useState(null)

  const playerList = useMemo(
    () => Object.values(players).sort((a, b) => a.pseudo.localeCompare(b.pseudo)),
    [players]
  )

  // Sélectionne le premier joueur par défaut : évite d'afficher une grille
  // sans "moi" désigné dès le premier chargement de la page.
  const activePlayerId = selectedPlayerId ?? playerList[0]?.id ?? null
  const activePlayer = playerList.find((p) => p.id === activePlayerId) || null

  // Regroupe les créneaux par case (jour × période) pour un accès direct
  // à "qui est dispo ici" sans reparcourir toute la liste à chaque cellule.
  const byCell = useMemo(() => {
    const map = new Map()
    Object.values(slots).forEach((slot) => {
      const key = cellKey(slot.day, slot.period)
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(slot.playerId)
    })
    return map
  }, [slots])

  // Meilleur créneau commun : celui avec le plus de joueurs disponibles.
  // En cas d'égalité, on garde le premier trouvé (simplification assumée —
  // l'objectif est un repère visuel rapide, pas un classement exhaustif).
  const bestKey = useMemo(() => {
    let best = null
    let bestCount = 0
    byCell.forEach((playerIds, key) => {
      if (playerIds.length > bestCount) {
        bestCount = playerIds.length
        best = key
      }
    })
    return bestCount > 0 ? best : null
  }, [byCell])

  const loading = playersStatus === 'loading' || availabilityStatus === 'loading'

  if (loading) {
    return (
      <main className="container">
        <Loader label="Chargement des disponibilités…" />
      </main>
    )
  }

  if (playerList.length === 0) {
    return (
      <main className="availability-page container">
        <div className="availability-page__header">
          <span className="eyebrow">Planning</span>
          <h1 className="availability-page__title">Disponibilités</h1>
          <p>Ajoutez d'abord des joueurs à l'effectif pour renseigner leurs disponibilités.</p>
        </div>
        <div className="availability-page__empty glass-panel">
          <p>Aucun joueur enregistré pour le moment.</p>
          <Link to="/team" className="btn-primary cut-corner-sm">
            Aller à l'effectif
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="availability-page container">
      <div className="availability-page__header">
        <span className="eyebrow">Planning</span>
        <h1 className="availability-page__title">Disponibilités</h1>
        <p>
          Chaque joueur coche ses créneaux libres dans la semaine — pas besoin de compte, il suffit
          de se sélectionner ci-dessous. Le créneau surligné en bas de grille est celui où le plus
          de monde est disponible.
        </p>
      </div>

      <div className="availability-page__picker glass-panel cut-corner-sm">
        <span className="availability-page__picker-label">Je suis :</span>
        <div className="availability-page__picker-list">
          {playerList.map((player) => (
            <button
              key={player.id}
              type="button"
              className={`filter-chip availability-page__picker-chip${
                activePlayerId === player.id ? ' filter-chip--active' : ''
              }`}
              aria-pressed={activePlayerId === player.id}
              onClick={() => setSelectedPlayerId(player.id)}
            >
              <PlayerAvatar player={player} size="sm" />
              {player.pseudo}
            </button>
          ))}
        </div>
      </div>

      <div className="availability-grid-wrap glass-panel">
        <div className="availability-grid">
          <div className="availability-grid__corner" aria-hidden="true" />
          {DAYS.map((d) => (
            <div key={d.day} className="availability-grid__day-head">
              {d.short}
            </div>
          ))}

          {PERIODS.map((p) => (
            <Fragment key={p.period}>
              <div className="availability-grid__period-label">{p.label}</div>
              {DAYS.map((d) => {
                const key = cellKey(d.day, p.period)
                const playerIds = byCell.get(key) || []
                const mine = activePlayerId != null && playerIds.includes(activePlayerId)
                const isBest = bestKey === key
                return (
                  <button
                    key={key}
                    type="button"
                    className={`availability-grid__cell${mine ? ' availability-grid__cell--mine' : ''}${
                      isBest ? ' availability-grid__cell--best' : ''
                    }`}
                    style={mine && activePlayer ? { '--cell-color': activePlayer.color } : undefined}
                    aria-pressed={mine}
                    onClick={() => toggleSlot(activePlayerId, d.day, p.period)}
                    title={`${describeCell(key)}${playerIds.length ? ` — ${playerIds.length} disponible(s)` : ''}`}
                  >
                    {playerIds.length > 0 && <span className="availability-grid__cell-count">{playerIds.length}</span>}
                    <span className="availability-grid__cell-avatars">
                      {playerIds.slice(0, 4).map((pid, i) => (
                        <PlayerAvatar key={`${pid}-${i}`} player={players[pid]} size="sm" />
                      ))}
                      {playerIds.length > 4 && (
                        <span className="availability-grid__cell-more">+{playerIds.length - 4}</span>
                      )}
                    </span>
                  </button>
                )
              })}
            </Fragment>
          ))}
        </div>
      </div>

      {bestKey && (
        <p className="availability-page__best-note">
          <span className="availability-page__best-dot" aria-hidden="true" />
          Meilleur créneau commun : <strong>{describeCell(bestKey)}</strong> ({byCell.get(bestKey).length} joueur
          {byCell.get(bestKey).length > 1 ? 's' : ''})
        </p>
      )}
    </main>
  )
}
