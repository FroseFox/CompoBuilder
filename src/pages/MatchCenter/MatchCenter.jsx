import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useAuth } from '../../context/AuthContext'
import { useMatches } from '../../context/MatchesContext'
import { useData } from '../../context/DataContext'
import { useCompositions } from '../../context/CompositionsContext'
import { useToast } from '../../context/ToastContext'
import { useSettings } from '../../context/SettingsContext'
import { getCompsForMap } from '../../utils/compositions'
import {
  computeMatchResult,
  computeOverallRecord,
  formatSeriesScore,
  isMatchPlayed,
  isSeriesDecided,
  FORMAT_META,
  MATCH_FORMAT,
  MATCH_RESULT_META,
  MATCH_TYPE,
  MATCH_TYPE_META,
} from '../../utils/matches'
import { sendDiscordMessage, sendDiscordVoteImage, matchResultEmbed } from '../../utils/discordWebhook'
import { addVoteReactions, getVoteCounts } from '../../utils/discordBot'
import { renderMatchCard, matchCardFileName } from '../../utils/matchCard'
import ConfirmDialog from '../../components/ConfirmDialog/ConfirmDialog'
import Loader from '../../components/Loader/Loader'
import './MatchCenter.css'

const emptyMapRow = () => ({ mapUuid: '', compositionId: '', ourScore: '', opponentScore: '' })

const emptyForm = {
  matchType: MATCH_TYPE.MATCH,
  opponentName: '',
  format: MATCH_FORMAT.BO1,
  matchDate: '',
  matchTime: '',
  notes: '',
  vodUrl: '',
  maps: [emptyMapRow()],
}

/** Reconstruit le tableau de manches du formulaire à partir d'un match existant (édition / renseigner un résultat). */
function mapsToFormRows(match) {
  const rows = match.maps && match.maps.length > 0 ? match.maps : [emptyMapRow()]
  return rows.map((m) => ({
    mapUuid: m.mapUuid || '',
    compositionId: m.compositionId || '',
    ourScore: m.ourScore === null || m.ourScore === undefined ? '' : String(m.ourScore),
    opponentScore: m.opponentScore === null || m.opponentScore === undefined ? '' : String(m.opponentScore),
  }))
}

export default function MatchCenter() {
  const { isAdmin } = useAuth()
  const { maps } = useData()
  const { compositionsByMap } = useCompositions()
  const { matches, status, createMatch, updateMatch, deleteMatch } = useMatches()
  const { pushToast } = useToast()
  const { webhookUrl } = useSettings()

  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState('played') // 'played' | 'scheduled'
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [syncingPresenceId, setSyncingPresenceId] = useState(null)

  const mapByUuid = useMemo(() => new Map(maps.map((m) => [m.uuid, m])), [maps])

  const compositionName = (mapUuid, compositionId) => {
    if (!mapUuid || !compositionId) return null
    return Object.values(compositionsByMap[mapUuid] || {}).find((c) => c.id === compositionId)?.name || null
  }

  const playedMatches = useMemo(
    () =>
      Object.values(matches)
        .filter(isMatchPlayed)
        .sort((a, b) => {
          if (a.matchDate && b.matchDate) return b.matchDate.localeCompare(a.matchDate)
          if (a.matchDate) return -1
          if (b.matchDate) return 1
          return b.createdAt - a.createdAt
        }),
    [matches]
  )

  // Matchs à venir : les plus proches en premier ; sans date, à la fin.
  const upcomingMatches = useMemo(
    () =>
      Object.values(matches)
        .filter((m) => !isMatchPlayed(m))
        .sort((a, b) => {
          if (a.matchDate && b.matchDate) return a.matchDate.localeCompare(b.matchDate)
          if (a.matchDate) return -1
          if (b.matchDate) return 1
          return a.createdAt - b.createdAt
        }),
    [matches]
  )

  const matchList = playedMatches
  // Seules les séries réellement terminées comptent dans le bilan
  // global : un Bo3 mené 1-0 n'est pas encore une victoire.
  const record = useMemo(
    () => computeOverallRecord(playedMatches.filter(isSeriesDecided)),
    [playedMatches]
  )

  const openCreatePlayed = () => {
    setEditingId(null)
    setFormMode('played')
    setForm(emptyForm)
    setFormOpen(true)
  }

  const openCreateScheduled = () => {
    setEditingId(null)
    setFormMode('scheduled')
    setForm(emptyForm)
    setFormOpen(true)
  }

  const openEdit = (match) => {
    setEditingId(match.id)
    setFormMode(isMatchPlayed(match) ? 'played' : 'scheduled')
    setForm({
      matchType: match.matchType || MATCH_TYPE.MATCH,
      opponentName: match.opponentName || '',
      format: match.format,
      matchDate: match.matchDate || '',
      matchTime: match.matchTime || '',
      notes: match.notes || '',
      vodUrl: match.vodUrl || '',
      maps: mapsToFormRows(match),
    })
    setFormOpen(true)
  }

  // Bascule un match programmé (ou une série en cours) vers "joué" :
  // même formulaire, mais on force le mode 'played' pour faire
  // apparaître les champs de score des manches déjà choisies.
  const openFillResult = (match) => {
    setEditingId(match.id)
    setFormMode('played')
    setForm({
      matchType: match.matchType || MATCH_TYPE.MATCH,
      opponentName: match.opponentName || '',
      format: match.format,
      matchDate: match.matchDate || '',
      matchTime: match.matchTime || '',
      notes: match.notes || '',
      vodUrl: match.vodUrl || '',
      maps: mapsToFormRows(match),
    })
    setFormOpen(true)
  }

  const handleFormatChange = (newFormat) => {
    setForm((f) => {
      const maxMaps = FORMAT_META[newFormat].maxMaps
      return { ...f, format: newFormat, maps: f.maps.length > maxMaps ? f.maps.slice(0, maxMaps) : f.maps }
    })
  }

  const updateMapRow = (index, patch) => {
    setForm((f) => ({ ...f, maps: f.maps.map((m, i) => (i === index ? { ...m, ...patch } : m)) }))
  }

  const handleMapUuidChange = (index, mapUuid) => {
    // Changer de map invalide la composition précédemment choisie pour cette manche.
    updateMapRow(index, { mapUuid, compositionId: '' })
  }

  const addMapRow = () => {
    setForm((f) => (f.maps.length >= FORMAT_META[f.format].maxMaps ? f : { ...f, maps: [...f.maps, emptyMapRow()] }))
  }

  const removeMapRow = (index) => {
    setForm((f) => (f.maps.length <= 1 ? f : { ...f, maps: f.maps.filter((_, i) => i !== index) }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    // L'adversaire est optionnel : seule la première manche est requise
    // (voir MATCH_TYPE — c'est le type Scrim/Match qui catégorise l'entrée).
    if (!form.maps[0]?.mapUuid) return
    if (formMode === 'scheduled' && !form.matchDate) return

    const mapsPayload = form.maps
      .filter((m) => m.mapUuid)
      .map((m) => ({
        mapUuid: m.mapUuid,
        compositionId: m.compositionId || null,
        ourScore: formMode === 'scheduled' || m.ourScore === '' ? null : Number(m.ourScore),
        opponentScore: formMode === 'scheduled' || m.opponentScore === '' ? null : Number(m.opponentScore),
      }))

    const payload = {
      matchType: form.matchType,
      opponentName: form.opponentName.trim() || null,
      format: form.format,
      matchDate: form.matchDate || null,
      matchTime: form.matchTime || null,
      notes: form.notes.trim(),
      vodUrl: form.vodUrl.trim() || null,
    }

    const formatLabel = FORMAT_META[form.format].label
    const embedMaps = mapsPayload.map((m) => ({
      mapName: mapByUuid.get(m.mapUuid)?.name || 'Map inconnue',
      mapThumbnail: mapByUuid.get(m.mapUuid)?.thumbnail || null,
      compositionName: compositionName(m.mapUuid, m.compositionId),
      ourScore: m.ourScore,
      opponentScore: m.opponentScore,
    }))
    const playedEmbedMaps = embedMaps.filter((m) => m.ourScore !== null && m.opponentScore !== null)

    // Notifications Discord "best effort" : ne bloquent jamais l'UI et
    // n'affichent pas d'erreur si elles échouent (webhook non configuré,
    // Discord injoignable…) — l'enregistrement a déjà réussi de toute façon.
    if (editingId) {
      const previousMatch = matches[editingId]
      const willBePlayed = playedEmbedMaps.length > 0
      const resultJustFilled = previousMatch && !isMatchPlayed(previousMatch) && formMode === 'played' && willBePlayed
      await updateMatch(editingId, payload, mapsPayload)
      pushToast(resultJustFilled ? 'Résultat enregistré.' : 'Match mis à jour.', 'success')
      if (resultJustFilled && webhookUrl) {
        sendDiscordMessage(
          matchResultEmbed({
            opponentName: payload.opponentName,
            matchType: payload.matchType,
            formatLabel,
            seriesScore: formatSeriesScore({ format: form.format, maps: mapsPayload }),
            result: computeMatchResult({ format: form.format, maps: mapsPayload }),
            maps: playedEmbedMaps,
          })
        )
      }
    } else {
      const id = await createMatch(payload, mapsPayload)
      if (id && formMode === 'scheduled') {
        pushToast('Match programmé.', 'success')
        if (webhookUrl) {
          // Image seule (pas de texte Discord) : Format/Map(s)/Date/Heure
          // et l'instruction de présence sont dessinés directement sur la
          // carte — voir renderMatchCard dans utils/matchCard.js.
          // sendDiscordVoteImage (pas sendDiscordMessage) : on a besoin de
          // l'id du message pour y ajouter les réactions ✅/❌ de
          // validation de présence, et pouvoir compter les réponses
          // ensuite (voir handleSyncPresence).
          renderMatchCard({
            opponentName: payload.opponentName,
            matchType: payload.matchType,
            formatLabel: form.format,
            maps: embedMaps.map((m) => ({ name: m.mapName, thumbnail: m.mapThumbnail })),
            matchDate: payload.matchDate,
            matchTime: payload.matchTime,
          })
            .then((blob) => sendDiscordVoteImage({ blob, filename: matchCardFileName(payload.opponentName, payload.matchType) }))
            .then(async (sent) => {
              if (!sent) return
              const { ok: reacted, error: reactError } = await addVoteReactions(sent)
              // On affiche le message d'erreur renvoyé par le bot (secret
              // manquant, permissions Discord…) plutôt que d'échouer en
              // silence — sinon la seule piste était la console du
              // navigateur, que personne ne pense à ouvrir.
              if (!reacted) {
                pushToast(`Image envoyée, mais l'ajout des réactions ✅/❌ a échoué : ${reactError || 'raison inconnue'}.`, 'error')
              }
              await updateMatch(id, { presenceMessageId: sent.messageId, presenceChannelId: sent.channelId })
            })
        }
      } else if (id) {
        pushToast('Match enregistré.', 'success')
        if (webhookUrl) {
          sendDiscordMessage(
            matchResultEmbed({
              opponentName: payload.opponentName,
              matchType: payload.matchType,
              formatLabel,
              seriesScore: formatSeriesScore({ format: form.format, maps: mapsPayload }),
              result: computeMatchResult({ format: form.format, maps: mapsPayload }),
              maps: playedEmbedMaps,
            })
          )
        }
      }
    }
    setFormOpen(false)
  }

  const handleDelete = async () => {
    await deleteMatch(confirmDeleteId)
    setConfirmDeleteId(null)
    pushToast('Match supprimé.', 'success')
  }

  const handleSyncPresence = async (match) => {
    if (!match.presenceMessageId || !match.presenceChannelId || syncingPresenceId) return
    setSyncingPresenceId(match.id)
    try {
      const { counts, error } = await getVoteCounts({ channelId: match.presenceChannelId, messageId: match.presenceMessageId })
      if (!counts) {
        pushToast(`Impossible de récupérer la présence : ${error || 'raison inconnue'}.`, 'error')
        return
      }
      await updateMatch(match.id, {
        presenceYes: counts.yes,
        presenceNo: counts.no,
        presenceSyncedAt: new Date().toISOString(),
      })
    } finally {
      setSyncingPresenceId(null)
    }
  }

  return (
    <main className="match-center container">
      <div className="match-center__header">
        <div>
          <span className="home__eyebrow">Historique</span>
          <h1 className="match-center__title">Match Center</h1>
          <p>Vos matchs à venir et l'historique de vos matchs joués, en Bo1, Bo3 ou Bo5 : score par manche, maps, adversaire et compositions utilisées.</p>
        </div>
        <div className="match-center__header-actions">
          {matchList.length > 0 && (
            <Link to="/stats" className="btn btn-ghost">
              Voir les statistiques
            </Link>
          )}
          {isAdmin && (
            <button className="btn btn-ghost" onClick={openCreateScheduled}>
              + Programmer un match
            </button>
          )}
          {isAdmin && (
            <button className="btn btn-primary" onClick={openCreatePlayed}>
              + Ajouter un résultat
            </button>
          )}
        </div>
      </div>

      {status === 'ready' && matchList.length > 0 && (
        <div className="dashboard__stat-grid match-center__record">
          <div className="stat-card accent-card" style={{ '--accent-card-color': 'var(--role-sentinel)' }}>
            <span className="stat-card__value">{record.wins}</span>
            <span className="stat-card__label">Victoires</span>
          </div>
          <div className="stat-card accent-card" style={{ '--accent-card-color': 'var(--role-duelist)' }}>
            <span className="stat-card__value">{record.losses}</span>
            <span className="stat-card__label">Défaites</span>
          </div>
          <div className="stat-card accent-card" style={{ '--accent-card-color': 'var(--accent-amber)' }}>
            <span className="stat-card__value">{record.winRate}%</span>
            <span className="stat-card__label">Taux de victoire</span>
          </div>
          <div className="stat-card accent-card" style={{ '--accent-card-color': 'var(--text-tertiary)' }}>
            <span className="stat-card__value">{record.played}</span>
            <span className="stat-card__label">Séries terminées</span>
          </div>
        </div>
      )}

      {status === 'loading' && (
        <div className="container">
          <Loader label="Chargement des matchs…" />
        </div>
      )}

      {status === 'error' && (
        <div className="home__error glass-panel">
          <h3>Impossible de charger l'historique</h3>
          <p>Vérifiez votre connexion, ou réessayez dans un instant.</p>
        </div>
      )}

      {status === 'ready' && upcomingMatches.length > 0 && (
        <section className="match-center__upcoming">
          <div className="match-center__section-header">
            <h2>Matchs à venir</h2>
            <p>Programmés mais pas encore joués.</p>
          </div>
          <div className="upcoming-match-list">
            {upcomingMatches.map((match) => {
              const mapNames = match.maps.map((m) => mapByUuid.get(m.mapUuid)?.name).filter(Boolean)
              const singleComp = match.maps.length === 1 ? compositionName(match.maps[0]?.mapUuid, match.maps[0]?.compositionId) : null

              return (
                <div key={match.id} className="upcoming-match glass-panel">
                  <div className="upcoming-match__date">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <rect x="3.5" y="5" width="17" height="15.5" rx="2" stroke="currentColor" strokeWidth="1.8" />
                      <path d="M3.5 9.5h17M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                    {match.matchDate
                      ? new Date(match.matchDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
                      : 'Date à définir'}
                    {match.matchTime ? ` à ${match.matchTime.replace(':', 'h')}` : ''}
                  </div>
                  <div className="upcoming-match__info">
                    <span className="upcoming-match__type-row">
                      <span
                        className="match-type-badge"
                        style={{ '--type-color': MATCH_TYPE_META[match.matchType]?.color }}
                      >
                        {MATCH_TYPE_META[match.matchType]?.label || 'Match'}
                      </span>
                      {match.opponentName && <span className="upcoming-match__opponent">{match.opponentName}</span>}
                    </span>
                    <span className="upcoming-match__meta">
                      <span className="upcoming-match__format">{FORMAT_META[match.format]?.label}</span>
                      {' · '}
                      {mapNames.join(', ') || 'Map à définir'}
                      {singleComp ? ` · ${singleComp}` : ''}
                    </span>
                    {match.presenceMessageId && (match.presenceYes !== null || match.presenceNo !== null) && (
                      <span className="upcoming-match__presence">
                        Présence : ✅ {match.presenceYes ?? 0} · ❌ {match.presenceNo ?? 0}
                      </span>
                    )}
                  </div>
                  {isAdmin && (
                    <div className="upcoming-match__actions">
                      {match.presenceMessageId && (
                        <button
                          className="btn btn-ghost btn-icon"
                          onClick={() => handleSyncPresence(match)}
                          disabled={syncingPresenceId === match.id}
                          aria-label="Resynchroniser la présence Discord"
                          title="Resynchroniser la présence Discord"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                            <path
                              d="M4 12a8 8 0 0 1 13.66-5.66L20 8M20 4v4h-4M20 12a8 8 0 0 1-13.66 5.66L4 16m0 4v-4h4"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>
                      )}
                      <button className="btn btn-primary" onClick={() => openFillResult(match)}>
                        Renseigner le résultat
                      </button>
                      <button className="btn btn-ghost btn-icon" onClick={() => openEdit(match)} aria-label="Modifier">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                          <path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                        </svg>
                      </button>
                      <button
                        className="btn btn-ghost btn-icon"
                        onClick={() => setConfirmDeleteId(match.id)}
                        aria-label="Supprimer"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                          <path d="M5 7h14M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-9 0 1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {status === 'ready' && matchList.length === 0 && upcomingMatches.length === 0 && (
        <div className="match-center__empty glass-panel">
          <p>
            {isAdmin
              ? 'Aucun match enregistré pour le moment. Ajoutez un résultat ou programmez votre prochain match.'
              : "Aucun match n'a encore été enregistré."}
          </p>
        </div>
      )}

      {status === 'ready' && matchList.length > 0 && (
        <section>
          {upcomingMatches.length > 0 && (
            <div className="match-center__section-header">
              <h2>Historique</h2>
              <p>Matchs déjà joués (ou en cours).</p>
            </div>
          )}
          <div className="match-history-table-shell">
          <div className="match-history-table-wrap glass-panel">
          <table className="match-history-table">
            <thead>
              <tr>
                <th>Résultat</th>
                <th>Score</th>
                <th>Format</th>
                <th>Manches</th>
                <th>Type</th>
                <th>Date</th>
                <th>VOD</th>
                {isAdmin && <th aria-label="Actions" />}
              </tr>
            </thead>
            <tbody>
              {matchList.map((match) => {
                const decided = isSeriesDecided(match)
                const result = computeMatchResult(match)
                const meta = decided ? MATCH_RESULT_META[result] : { label: 'En cours', color: 'var(--accent-amber)' }

                return (
                  <tr key={match.id}>
                    <td>
                      <span className="match-result-badge" style={{ '--result-color': meta.color }}>
                        {meta.label}
                      </span>
                    </td>
                    <td className="match-history-table__score">{formatSeriesScore(match)}</td>
                    <td className="match-history-table__muted">{FORMAT_META[match.format]?.label}</td>
                    <td>
                      <div className="match-history-table__map-list">
                        {match.maps.map((m) => {
                          const map = mapByUuid.get(m.mapUuid)
                          const comp = compositionName(m.mapUuid, m.compositionId)
                          const played = m.ourScore !== null && m.ourScore !== undefined
                          return (
                            <span key={m.id} className="match-history-table__map">
                              {map?.thumbnail && <img src={map.thumbnail} alt="" />}
                              <span>
                                {map?.name || 'Map inconnue'}
                                {played && <span className="match-history-table__map-score"> {m.ourScore}:{m.opponentScore}</span>}
                                {match.maps.length === 1 && comp && <span className="match-history-table__muted"> · {comp}</span>}
                              </span>
                            </span>
                          )
                        })}
                      </div>
                    </td>
                    <td>
                      <div className="match-history-table__type-cell">
                        <span
                          className="match-type-badge"
                          style={{ '--type-color': MATCH_TYPE_META[match.matchType]?.color }}
                        >
                          {MATCH_TYPE_META[match.matchType]?.label || 'Match'}
                        </span>
                        {match.opponentName && <span className="match-history-table__muted"> {match.opponentName}</span>}
                      </div>
                    </td>
                    <td className="match-history-table__muted">
                      {match.matchDate
                        ? new Date(match.matchDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
                        : '—'}
                    </td>
                    <td>
                      {match.vodUrl ? (
                        <a
                          href={match.vodUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="match-history-table__vod-link"
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path d="M8 6.5v11l9-5.5-9-5.5Z" fill="currentColor" />
                          </svg>
                          VOD
                        </a>
                      ) : (
                        <span className="match-history-table__muted">—</span>
                      )}
                    </td>
                    {isAdmin && (
                      <td className="match-history-table__actions">
                        <button className="btn btn-ghost btn-icon" onClick={() => openEdit(match)} aria-label="Modifier">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                            <path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                          </svg>
                        </button>
                        <button
                          className="btn btn-ghost btn-icon"
                          onClick={() => setConfirmDeleteId(match.id)}
                          aria-label="Supprimer"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                            <path d="M5 7h14M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-9 0 1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
          {/* Indice visuel : sur mobile le tableau est plus large que l'écran
              et se fait défiler au doigt horizontalement — ce voile en
              dégradé sur le bord droit le signale (sinon rien ne l'indique). */}
          <div className="match-history-table-shell__fade" aria-hidden="true" />
          </div>
        </section>
      )}

      <AnimatePresence>
        {formOpen && (
          <motion.div
            className="confirm-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={() => setFormOpen(false)}
          >
            <motion.form
              className="player-form glass-panel match-center__form"
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 400, damping: 32 } }}
              exit={{ opacity: 0, y: 10, scale: 0.98, transition: { duration: 0.15, ease: [0.4, 0, 1, 1] } }}
              onClick={(e) => e.stopPropagation()}
              onSubmit={handleSubmit}
            >
              <h3>
                {formMode === 'scheduled'
                  ? editingId
                    ? 'Modifier le match programmé'
                    : 'Programmer un match'
                  : editingId
                    ? 'Modifier le match'
                    : 'Ajouter un résultat'}
              </h3>

              <label className="player-form__field">
                <span>Type</span>
                <div className="match-center__type-toggle" role="radiogroup" aria-label="Type de match">
                  {Object.entries(MATCH_TYPE_META).map(([value, meta]) => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={form.matchType === value}
                      className={`match-center__type-option${form.matchType === value ? ' match-center__type-option--active' : ''}`}
                      style={{ '--type-color': meta.color }}
                      onClick={() => setForm((f) => ({ ...f, matchType: value }))}
                    >
                      {meta.label}
                    </button>
                  ))}
                </div>
              </label>

              <label className="player-form__field">
                <span>Adversaire (optionnel)</span>
                <input
                  type="text"
                  autoFocus
                  value={form.opponentName}
                  onChange={(e) => setForm((f) => ({ ...f, opponentName: e.target.value }))}
                  placeholder="Ex. Team Liquid — laisser vide si inconnu ou sans objet"
                />
              </label>

              <label className="player-form__field">
                <span>Format</span>
                <select value={form.format} onChange={(e) => handleFormatChange(e.target.value)}>
                  {Object.entries(FORMAT_META).map(([value, meta]) => (
                    <option key={value} value={value}>
                      {meta.label} — {meta.maxMaps === 1 ? '1 map' : `jusqu'à ${meta.maxMaps} maps`}
                    </option>
                  ))}
                </select>
              </label>

              <div className="match-center__map-rows">
                {form.maps.map((mapRow, index) => {
                  const compsForRow = mapRow.mapUuid ? getCompsForMap(compositionsByMap, mapRow.mapUuid) : []
                  return (
                    <div key={index} className="match-center__map-row">
                      <div className="match-center__map-row-header">
                        <span>Manche {index + 1}</span>
                        {form.maps.length > 1 && (
                          <button
                            type="button"
                            className="match-center__map-row-remove"
                            onClick={() => removeMapRow(index)}
                            aria-label={`Retirer la manche ${index + 1}`}
                          >
                            Retirer
                          </button>
                        )}
                      </div>

                      <div className="match-center__form-row">
                        <label className="player-form__field">
                          <span>Map</span>
                          <select
                            value={mapRow.mapUuid}
                            onChange={(e) => handleMapUuidChange(index, e.target.value)}
                            required={index === 0}
                          >
                            <option value="">Choisir une map…</option>
                            {maps.map((m) => (
                              <option key={m.uuid} value={m.uuid}>
                                {m.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="player-form__field">
                          <span>Composition (optionnel)</span>
                          <select
                            value={mapRow.compositionId}
                            onChange={(e) => updateMapRow(index, { compositionId: e.target.value })}
                            disabled={!mapRow.mapUuid}
                          >
                            <option value="">Aucune / non renseignée</option>
                            {compsForRow.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>

                      {formMode === 'played' && (
                        <div className="match-center__form-row">
                          <label className="player-form__field">
                            <span>Notre score</span>
                            <input
                              type="number"
                              min="0"
                              value={mapRow.ourScore}
                              onChange={(e) => updateMapRow(index, { ourScore: e.target.value })}
                              placeholder="13"
                            />
                          </label>
                          <label className="player-form__field">
                            <span>Score adverse</span>
                            <input
                              type="number"
                              min="0"
                              value={mapRow.opponentScore}
                              onChange={(e) => updateMapRow(index, { opponentScore: e.target.value })}
                              placeholder="7"
                            />
                          </label>
                        </div>
                      )}
                    </div>
                  )
                })}

                {form.maps.length < FORMAT_META[form.format].maxMaps && (
                  <button type="button" className="btn btn-ghost match-center__add-map" onClick={addMapRow}>
                    + Ajouter une manche
                  </button>
                )}
              </div>

              <div className="match-center__form-row">
                <label className="player-form__field">
                  <span>Date{formMode === 'played' ? ' (optionnel)' : ''}</span>
                  <input
                    type="date"
                    required={formMode === 'scheduled'}
                    value={form.matchDate}
                    onChange={(e) => setForm((f) => ({ ...f, matchDate: e.target.value }))}
                  />
                </label>
                <label className="player-form__field">
                  <span>Heure (optionnel)</span>
                  <input
                    type="time"
                    value={form.matchTime}
                    onChange={(e) => setForm((f) => ({ ...f, matchTime: e.target.value }))}
                  />
                </label>
              </div>

              {formMode === 'played' && (
                <label className="player-form__field">
                  <span>Lien VOD (optionnel)</span>
                  <input
                    type="url"
                    value={form.vodUrl}
                    onChange={(e) => setForm((f) => ({ ...f, vodUrl: e.target.value }))}
                    placeholder="https://twitch.tv/videos/… ou https://youtube.com/…"
                  />
                </label>
              )}

              <label className="player-form__field">
                <span>Notes (optionnel)</span>
                <input
                  type="text"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Ex. eco round perdu manche 4…"
                />
              </label>

              <div className="confirm-dialog__actions">
                <button type="button" className="btn btn-ghost" onClick={() => setFormOpen(false)}>
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingId ? 'Enregistrer' : formMode === 'scheduled' ? 'Programmer' : 'Ajouter'}
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={Boolean(confirmDeleteId)}
        title="Supprimer ce match ?"
        description="Cette entrée d'historique sera définitivement supprimée."
        confirmLabel="Supprimer"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </main>
  )
}
