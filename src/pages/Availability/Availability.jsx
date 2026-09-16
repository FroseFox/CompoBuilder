import { Fragment, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { usePlayers } from '../../context/PlayersContext'
import { useAvailability } from '../../context/AvailabilityContext'
import { useMatches } from '../../context/MatchesContext'
import PlayerAvatar from '../../components/PlayerAvatar/PlayerAvatar'
import Loader from '../../components/Loader/Loader'
import './Availability.css'

const PERIODS = [
  { period: 'morning', label: 'Matin' },
  { period: 'afternoon', label: 'Après-midi' },
  { period: 'evening', label: 'Soir' },
]

const DAY_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

function pad(n) {
  return String(n).padStart(2, '0')
}

/** "YYYY-MM-DD" à partir d'un Date local — jamais via toISOString() (qui
 *  bascule en UTC et peut faire déborder sur le jour d'avant/d'après). */
function toISODate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function startOfWeek(base) {
  const d = new Date(base)
  const dow = d.getDay() // 0 = dimanche
  const diff = dow === 0 ? -6 : 1 - dow
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

/** Les 7 jours (lundi → dimanche) de la semaine décalée de `weekOffset`
 *  semaines par rapport à aujourd'hui — de vraies dates de calendrier,
 *  pas des jours de semaine récurrents. */
function getWeekDays(weekOffset) {
  const start = startOfWeek(new Date())
  start.setDate(start.getDate() + weekOffset * 7)
  const todayIso = toISODate(new Date())
  return DAY_SHORT.map((short, i) => {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    const iso = toISODate(d)
    return {
      date: iso,
      short,
      label: d.toLocaleDateString('fr-FR', { weekday: 'long' }),
      monthLabel: d.toLocaleDateString('fr-FR', { month: 'long' }),
      dayNum: d.getDate(),
      year: d.getFullYear(),
      isToday: iso === todayIso,
    }
  })
}

function formatWeekRange(days) {
  const first = days[0]
  const last = days[6]
  if (first.monthLabel === last.monthLabel) {
    return `${first.dayNum} – ${last.dayNum} ${last.monthLabel} ${last.year}`
  }
  return `${first.dayNum} ${first.monthLabel} – ${last.dayNum} ${last.monthLabel} ${last.year}`
}

function formatMatchTime(time) {
  return time ? time.slice(0, 5) : ''
}

// "::" plutôt que "-" : une date ISO contient déjà des tirets, la
// séparation serait ambiguë à re-découper.
function cellKey(date, period) {
  return `${date}::${period}`
}

function describeCell(key, days) {
  const [date, period] = key.split('::')
  const day = days.find((d) => d.date === date)
  const periodMeta = PERIODS.find((p) => p.period === period)
  const dayLabel = day ? `${day.label} ${day.dayNum} ${day.monthLabel}` : date
  return `${dayLabel} · ${periodMeta?.label ?? ''}`
}

export default function Availability() {
  const { user, isAdmin, signInWithDiscord } = useAuth()
  const { players, status: playersStatus, claimPlayer } = usePlayers()
  const { slots, status: availabilityStatus, toggleSlot } = useAvailability()
  const { matches } = useMatches()

  const [weekOffset, setWeekOffset] = useState(0)
  const [selectedPlayerId, setSelectedPlayerId] = useState(null)
  const [claimSelection, setClaimSelection] = useState('')
  const [claiming, setClaiming] = useState(false)

  const playerList = useMemo(
    () => Object.values(players).sort((a, b) => a.pseudo.localeCompare(b.pseudo)),
    [players]
  )

  // Le joueur auquel MON compte est associé (voir claimPlayer) — c'est
  // cette fiche, et uniquement elle, que je peux cocher si je ne suis
  // pas admin.
  const myPlayer = useMemo(
    () => (user ? playerList.find((p) => p.userId === user.id) || null : null),
    [playerList, user]
  )

  const unclaimedPlayers = useMemo(() => playerList.filter((p) => !p.userId), [playerList])

  const days = useMemo(() => getWeekDays(weekOffset), [weekOffset])

  const matchesByDate = useMemo(() => {
    const map = new Map()
    Object.values(matches).forEach((m) => {
      if (!m.matchDate) return
      if (!map.has(m.matchDate)) map.set(m.matchDate, [])
      map.get(m.matchDate).push(m)
    })
    return map
  }, [matches])

  const byCell = useMemo(() => {
    const map = new Map()
    Object.values(slots).forEach((slot) => {
      const key = cellKey(slot.date, slot.period)
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(slot.playerId)
    })
    return map
  }, [slots])

  // Meilleur créneau commun DE LA SEMAINE AFFICHÉE — les créneaux sont
  // maintenant de vraies dates, comparer entre semaines n'aurait pas de sens.
  const bestKey = useMemo(() => {
    let best = null
    let bestCount = 0
    days.forEach((day) => {
      PERIODS.forEach((p) => {
        const key = cellKey(day.date, p.period)
        const count = byCell.get(key)?.length || 0
        if (count > bestCount) {
          bestCount = count
          best = key
        }
      })
    })
    return bestCount > 0 ? best : null
  }, [days, byCell])

  // Un admin peut cocher pour n'importe quel joueur (utile tant que tout
  // le monde n'a pas encore de compte) ; les autres ne peuvent cocher que
  // la fiche à laquelle leur compte est associé.
  const canEdit = isAdmin || Boolean(myPlayer)
  const activePlayerId = isAdmin
    ? selectedPlayerId ?? myPlayer?.id ?? playerList[0]?.id ?? null
    : myPlayer?.id ?? null
  const activePlayer = playerList.find((p) => p.id === activePlayerId) || null

  const handleClaim = async () => {
    if (!claimSelection) return
    setClaiming(true)
    const ok = await claimPlayer(claimSelection)
    setClaiming(false)
    if (ok) setClaimSelection('')
  }

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
          Connecte-toi avec Discord pour cocher tes disponibilités sur les vraies dates de la semaine
          — les jours où un match est prévu sont signalés directement sur la grille. Pas besoin de
          compte pour simplement la consulter.
        </p>
      </div>

      {!user && (
        <div className="availability-page__auth glass-panel cut-corner-sm">
          <p className="availability-page__auth-hint">
            Connecte-toi avec Discord pour cocher tes propres créneaux — ta fiche joueur se crée (ou se
            retrouve) automatiquement, rien d'autre à faire.
          </p>
          <button type="button" className="btn btn-primary" onClick={signInWithDiscord}>
            Se connecter avec Discord
          </button>
        </div>
      )}

      {user && !isAdmin && !myPlayer && (
        <div className="availability-page__claim glass-panel cut-corner-sm">
          <p>
            Ton compte Discord n'est relié à aucune fiche joueur — ta fiche a normalement dû être créée
            automatiquement ; c'est probablement un ancien profil créé avant le passage à la connexion
            Discord. Choisis lequel est le tien ci-dessous pour t'y associer.
          </p>
          {unclaimedPlayers.length === 0 ? (
            <p className="availability-page__claim-empty">
              Tous les joueurs de l'effectif ont déjà un compte associé — demande à un admin de vérifier
              ta fiche dans l'effectif.
            </p>
          ) : (
            <div className="availability-page__claim-row">
              <select value={claimSelection} onChange={(e) => setClaimSelection(e.target.value)}>
                <option value="">Je suis…</option>
                {unclaimedPlayers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.pseudo}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleClaim}
                disabled={!claimSelection || claiming}
              >
                {claiming ? 'Association…' : 'Associer'}
              </button>
            </div>
          )}
        </div>
      )}

      {(isAdmin || myPlayer) && (
        <div className="availability-page__picker glass-panel cut-corner-sm">
          {isAdmin ? (
            <>
              <span className="availability-page__picker-label">Modifier pour :</span>
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
                    {!player.userId && <span className="availability-page__unclaimed">sans compte</span>}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <span className="availability-page__picker-label">
              Connecté en tant que <strong>{myPlayer.pseudo}</strong>
            </span>
          )}
        </div>
      )}

      <div className="availability-page__weeknav">
        <button type="button" className="btn btn-ghost" onClick={() => setWeekOffset((w) => w - 1)}>
          ‹ Précédente
        </button>
        <div className="availability-page__weeknav-range">
          <span>{formatWeekRange(days)}</span>
          {weekOffset !== 0 && (
            <button type="button" className="availability-page__weeknav-today" onClick={() => setWeekOffset(0)}>
              Revenir à cette semaine
            </button>
          )}
        </div>
        <button type="button" className="btn btn-ghost" onClick={() => setWeekOffset((w) => w + 1)}>
          Suivante ›
        </button>
      </div>

      <div className="availability-grid-wrap glass-panel">
        <div className="availability-grid">
          <div className="availability-grid__corner" aria-hidden="true" />
          {days.map((day) => {
            const dayMatches = matchesByDate.get(day.date) || []
            return (
              <div
                key={day.date}
                className={`availability-grid__day-head${day.isToday ? ' availability-grid__day-head--today' : ''}`}
              >
                <span className="availability-grid__day-short">{day.short}</span>
                <span className="availability-grid__day-num">{day.dayNum}</span>
                {dayMatches.map((m) => (
                  <span key={m.id} className="availability-grid__match-badge" title={`Match vs ${m.opponentName}`}>
                    vs {m.opponentName}
                    {m.matchTime ? ` · ${formatMatchTime(m.matchTime)}` : ''}
                  </span>
                ))}
              </div>
            )
          })}

          {PERIODS.map((p) => (
            <Fragment key={p.period}>
              <div className="availability-grid__period-label">{p.label}</div>
              {days.map((day) => {
                const key = cellKey(day.date, p.period)
                const playerIds = byCell.get(key) || []
                const mine = activePlayerId != null && playerIds.includes(activePlayerId)
                const isBest = bestKey === key
                const hasMatch = matchesByDate.has(day.date)
                return (
                  <button
                    key={key}
                    type="button"
                    className={`availability-grid__cell${mine ? ' availability-grid__cell--mine' : ''}${
                      isBest ? ' availability-grid__cell--best' : ''
                    }${hasMatch ? ' availability-grid__cell--match-day' : ''}`}
                    style={mine && activePlayer ? { '--cell-color': activePlayer.color } : undefined}
                    aria-pressed={mine}
                    disabled={!canEdit}
                    onClick={canEdit ? () => toggleSlot(activePlayerId, day.date, p.period) : undefined}
                    title={`${describeCell(key, days)}${playerIds.length ? ` — ${playerIds.length} disponible(s)` : ''}`}
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
          Meilleur créneau commun cette semaine : <strong>{describeCell(bestKey, days)}</strong> (
          {byCell.get(bestKey).length} joueur{byCell.get(bestKey).length > 1 ? 's' : ''})
        </p>
      )}
    </main>
  )
}
