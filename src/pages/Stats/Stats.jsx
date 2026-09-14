import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useMatches } from '../../context/MatchesContext'
import { useData } from '../../context/DataContext'
import { useCompositions } from '../../context/CompositionsContext'
import { usePlayers } from '../../context/PlayersContext'
import {
  computeOverallRecord,
  computeMapStats,
  computeCompositionStatsByMap,
  computeOpponentStats,
  computePlayerStats,
  getRecentForm,
  computeMatchResult,
  isMatchPlayed,
  MATCH_RESULT_META,
} from '../../utils/matches'
import ProgressBar from '../../components/ProgressBar/ProgressBar'
import PlayerAvatar from '../../components/PlayerAvatar/PlayerAvatar'
import Loader from '../../components/Loader/Loader'
import CountUp from '../../components/CountUp/CountUp'
import './Stats.css'

export default function Stats() {
  const { matches, status } = useMatches()
  const { maps, agents } = useData()
  const { compositionsByMap } = useCompositions()
  const { players } = usePlayers()

  // Seuls les matchs joués comptent dans les statistiques — un match
  // programmé (à venir, sans score) fausserait les taux de victoire.
  const matchList = useMemo(() => Object.values(matches).filter(isMatchPlayed), [matches])

  const overall = useMemo(() => computeOverallRecord(matchList), [matchList])
  const mapStats = useMemo(() => computeMapStats(matchList, maps), [matchList, maps])
  const compStatsByMap = useMemo(
    () => computeCompositionStatsByMap(matchList, compositionsByMap, maps),
    [matchList, compositionsByMap, maps]
  )
  const opponentStats = useMemo(() => computeOpponentStats(matchList), [matchList])
  const playerStats = useMemo(
    () => computePlayerStats(matchList, compositionsByMap, players, agents),
    [matchList, compositionsByMap, players, agents]
  )
  const recentForm = useMemo(() => getRecentForm(matchList, 8), [matchList])

  if (status === 'loading') {
    return (
      <main className="container">
        <Loader label="Chargement des statistiques…" />
      </main>
    )
  }

  if (status === 'ready' && matchList.length === 0) {
    return (
      <main className="stats-page container">
        <div className="stats-page__header">
          <span className="home__eyebrow">Performance</span>
          <h1 className="stats-page__title">Statistiques</h1>
          <p>Les tendances de votre équipe apparaîtront ici dès que des matchs seront enregistrés.</p>
        </div>
        <div className="stats-page__empty glass-panel">
          <p>Aucun match enregistré pour le moment.</p>
          <Link to="/matchcenter" className="btn btn-primary">
            Aller au Match Center
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="stats-page container">
      <div className="stats-page__header">
        <span className="home__eyebrow">Performance</span>
        <h1 className="stats-page__title">Statistiques</h1>
        <p>Ce que votre historique de matchs révèle : maps fortes, compositions qui fonctionnent, forme du moment.</p>
      </div>

      <section className="stats-section">
        <div className="dashboard__stat-grid stats-page__overview">
          <OverviewCard index={0} icon={PlayedGlyph} value={overall.played} label="Matchs joués" />
          <OverviewCard index={1} icon={WinGlyph} value={overall.wins} label="Victoires" tone="win" />
          <OverviewCard index={2} icon={LossGlyph} value={overall.losses} label="Défaites" tone="loss" />
          <OverviewCard index={3} icon={RateGlyph} value={`${overall.winRate}%`} label="Taux de victoire" tone="rate" />
        </div>
      </section>

      <section className="stats-section">
        <div className="editor__section-header">
          <h2>Forme récente</h2>
          <p>Les {recentForm.length} derniers matchs, du plus ancien au plus récent.</p>
        </div>
        <div className="stats-page__form-row">
          {recentForm.map((match, index) => {
            const result = computeMatchResult(match)
            const meta = MATCH_RESULT_META[result]
            return (
              <motion.span
                key={match.id}
                className="stats-form-chip"
                style={{ '--result-color': meta.color }}
                title={`${match.opponentName} · ${match.ourScore}-${match.opponentScore}`}
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.25, delay: index * 0.04, type: 'spring', stiffness: 400, damping: 24 }}
              >
                {meta.label[0]}
              </motion.span>
            )
          })}
        </div>
      </section>

      <section className="stats-section">
        <div className="editor__section-header">
          <h2>Taux de victoire par map</h2>
          <p>Vos maps les plus fiables, et celles à retravailler en priorité.</p>
        </div>
        <div className="stats-page__list">
          {mapStats.map((s, index) => (
            <motion.div
              key={s.mapUuid}
              className="stats-row glass-panel"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: Math.min(index * 0.05, 0.3), ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="stats-row__label">
                {s.mapThumbnail && <img src={s.mapThumbnail} alt="" className="stats-row__thumb" />}
                <span>{s.mapName}</span>
              </div>
              <span className="stats-row__record">
                {s.wins}V – {s.losses}D{s.draws > 0 ? ` – ${s.draws}N` : ''}
              </span>
              <div className="stats-row__bar">
                <ProgressBar percent={s.winRate} />
              </div>
              <span className="stats-row__percent">{s.winRate}%</span>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="stats-section">
        <div className="editor__section-header">
          <h2>Meilleure composition par map</h2>
          <p>Pour chaque map jouée, vos compositions classées par taux de victoire.</p>
        </div>
        {compStatsByMap.length === 0 ? (
          <div className="stats-page__empty glass-panel">
            <p>Aucun match n'a encore de composition associée.</p>
          </div>
        ) : (
          <div className="stats-page__map-groups">
            {compStatsByMap.map((group, groupIndex) => (
              <motion.div
                key={group.mapUuid}
                className="stats-map-group glass-panel"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: Math.min(groupIndex * 0.06, 0.3), ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="stats-map-group__header">
                  {group.mapThumbnail && <img src={group.mapThumbnail} alt="" className="stats-map-group__thumb" />}
                  <h3>{group.mapName}</h3>
                  <span className="stats-map-group__count">{group.totalPlayed} match(s)</span>
                </div>

                <div className="stats-page__list">
                  {group.compositions.map((c) => (
                    <div key={c.compositionId} className={`stats-row stats-row--nested ${c.isBest ? 'stats-row--best' : ''}`}>
                      <div className="stats-row__label">
                        {c.isBest && <span className="stats-row__best-badge">★ Meilleure</span>}
                        <span>{c.compositionName}</span>
                      </div>
                      <span className="stats-row__record">
                        {c.wins}V – {c.losses}D{c.draws > 0 ? ` – ${c.draws}N` : ''}
                      </span>
                      <div className="stats-row__bar">
                        <ProgressBar percent={c.winRate} />
                      </div>
                      <span className="stats-row__percent">{c.winRate}%</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      <section className="stats-section">
        <div className="editor__section-header">
          <h2>Performance par joueur</h2>
          <p>Taux de victoire de chaque joueur sur les matchs où il faisait partie de la composition utilisée.</p>
        </div>
        {playerStats.length === 0 ? (
          <div className="stats-page__empty glass-panel">
            <p>Aucun joueur n'apparaît encore dans un match avec une composition assignée.</p>
          </div>
        ) : (
          <div className="stats-page__list">
            {playerStats.map((p, index) => (
              <motion.div
                key={p.playerId}
                className="stats-row stats-row--player glass-panel"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: Math.min(index * 0.05, 0.3), ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="stats-row__label">
                  <PlayerAvatar player={p.player} size="sm" />
                  <span>
                    {p.player.pseudo}
                    {p.topAgent && <span className="stats-row__caption"> · joue souvent {p.topAgent.name}</span>}
                  </span>
                </div>
                <span className="stats-row__record">
                  {p.wins}V – {p.losses}D{p.draws > 0 ? ` – ${p.draws}N` : ''}
                </span>
                <div className="stats-row__bar">
                  <ProgressBar percent={p.winRate} />
                </div>
                <span className="stats-row__percent">{p.winRate}%</span>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      <section className="stats-section">
        <div className="editor__section-header">
          <h2>Face à chaque adversaire</h2>
          <p>Votre bilan contre les équipes les plus rencontrées.</p>
        </div>
        <div className="stats-page__list">
          {opponentStats.map((s, index) => (
            <motion.div
              key={s.opponentName}
              className="stats-row glass-panel"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: Math.min(index * 0.05, 0.3), ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="stats-row__label">
                <span>{s.opponentName}</span>
              </div>
              <span className="stats-row__record">
                {s.wins}V – {s.losses}D{s.draws > 0 ? ` – ${s.draws}N` : ''}
              </span>
              <div className="stats-row__bar">
                <ProgressBar percent={s.winRate} />
              </div>
              <span className="stats-row__percent">{s.winRate}%</span>
            </motion.div>
          ))}
        </div>
      </section>
    </main>
  )
}

function OverviewCard({ value, label, tone, icon: Icon, index = 0 }) {
  return (
    <motion.div
      className={`stat-card ${tone ? `stats-page__overview-card--${tone}` : ''}`}
      initial={{ opacity: 0, y: 12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] }}
    >
      {Icon && (
        <span className="stat-card__icon">
          <Icon />
        </span>
      )}
      <span className="stat-card__value">
        <CountUp value={value} />
      </span>
      <span className="stat-card__label">{label}</span>
    </motion.div>
  )
}

function PlayedGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M4 5h16v10H4z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M9 19h6M12 15v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}
function WinGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M4 12.5 9.5 18 20 6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function LossGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
function RateGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M4 20V10M12 20V4M20 20v-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}
