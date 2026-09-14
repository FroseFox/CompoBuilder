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
import { computeMatchResult, isMatchPlayed, MATCH_RESULT_META } from '../../utils/matches'
import { sendDiscordMessage, matchResultEmbed, matchScheduledEmbed } from '../../utils/discordWebhook'
import ConfirmDialog from '../../components/ConfirmDialog/ConfirmDialog'
import Loader from '../../components/Loader/Loader'
import './MatchCenter.css'

const emptyForm = {
  opponentName: '',
  mapUuid: '',
  compositionId: '',
  ourScore: '',
  opponentScore: '',
  matchDate: '',
  notes: '',
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

  const mapByUuid = useMemo(() => new Map(maps.map((m) => [m.uuid, m])), [maps])

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

  const compsForSelectedMap = useMemo(
    () => (form.mapUuid ? getCompsForMap(compositionsByMap, form.mapUuid) : []),
    [compositionsByMap, form.mapUuid]
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
      opponentName: match.opponentName,
      mapUuid: match.mapUuid,
      compositionId: match.compositionId || '',
      ourScore: match.ourScore === null || match.ourScore === undefined ? '' : String(match.ourScore),
      opponentScore: match.opponentScore === null || match.opponentScore === undefined ? '' : String(match.opponentScore),
      matchDate: match.matchDate || '',
      notes: match.notes || '',
    })
    setFormOpen(true)
  }

  // Bascule un match programmé vers "joué" : même formulaire, mais on
  // force le mode 'played' pour faire apparaître les champs de score
  // (qui valent '' puisque le match n'a pas encore de résultat).
  const openFillResult = (match) => {
    setEditingId(match.id)
    setFormMode('played')
    setForm({
      opponentName: match.opponentName,
      mapUuid: match.mapUuid,
      compositionId: match.compositionId || '',
      ourScore: '',
      opponentScore: '',
      matchDate: match.matchDate || '',
      notes: match.notes || '',
    })
    setFormOpen(true)
  }

  const handleMapChange = (mapUuid) => {
    // Changer de map invalide la composition précédemment choisie
    // (une composition est propre à une map).
    setForm((f) => ({ ...f, mapUuid, compositionId: '' }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.opponentName.trim() || !form.mapUuid) return
    if (formMode === 'scheduled' && !form.matchDate) return

    const payload = {
      opponentName: form.opponentName.trim(),
      mapUuid: form.mapUuid,
      compositionId: form.compositionId || null,
      ourScore: formMode === 'scheduled' ? null : Number(form.ourScore) || 0,
      opponentScore: formMode === 'scheduled' ? null : Number(form.opponentScore) || 0,
      matchDate: form.matchDate || null,
      notes: form.notes.trim(),
    }

    // Notifications Discord "best effort" : ne bloquent jamais l'UI et
    // n'affichent pas d'erreur si elles échouent (webhook non configuré,
    // Discord injoignable…) — l'enregistrement a déjà réussi de toute façon.
    if (editingId) {
      const previousMatch = matches[editingId]
      const resultJustFilled = previousMatch && !isMatchPlayed(previousMatch) && formMode === 'played'
      await updateMatch(editingId, payload)
      pushToast(resultJustFilled ? 'Résultat enregistré.' : 'Match mis à jour.', 'success')
      if (resultJustFilled && webhookUrl) {
        sendDiscordMessage(
          matchResultEmbed({
            opponentName: payload.opponentName,
            ourScore: payload.ourScore,
            opponentScore: payload.opponentScore,
            mapName: mapByUuid.get(payload.mapUuid)?.name,
          })
        )
      }
    } else {
      const id = await createMatch(payload)
      if (id && formMode === 'scheduled') {
        pushToast('Match programmé.', 'success')
        if (webhookUrl) {
          sendDiscordMessage(
            matchScheduledEmbed({
              opponentName: payload.opponentName,
              matchDate: payload.matchDate,
              mapName: mapByUuid.get(payload.mapUuid)?.name,
            })
          )
        }
      } else if (id) {
        pushToast('Match enregistré.', 'success')
        if (webhookUrl) {
          sendDiscordMessage(
            matchResultEmbed({
              opponentName: payload.opponentName,
              ourScore: payload.ourScore,
              opponentScore: payload.opponentScore,
              mapName: mapByUuid.get(payload.mapUuid)?.name,
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

  return (
    <main className="match-center container">
      <div className="match-center__header">
        <div>
          <span className="home__eyebrow">Historique</span>
          <h1 className="match-center__title">Match Center</h1>
          <p>Vos matchs à venir et l'historique de vos matchs joués : score, map, adversaire et composition utilisée.</p>
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
              const map = mapByUuid.get(match.mapUuid)
              const comp = match.compositionId
                ? Object.values(compositionsByMap[match.mapUuid] || {}).find((c) => c.id === match.compositionId)
                : null

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
                  </div>
                  <div className="upcoming-match__info">
                    <span className="upcoming-match__opponent">{match.opponentName}</span>
                    <span className="upcoming-match__meta">
                      {map?.name || 'Map à définir'}
                      {comp ? ` · ${comp.name}` : ''}
                    </span>
                  </div>
                  {isAdmin && (
                    <div className="upcoming-match__actions">
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
              <p>Matchs déjà joués.</p>
            </div>
          )}
          <div className="match-history-table-wrap glass-panel">
          <table className="match-history-table">
            <thead>
              <tr>
                <th>Résultat</th>
                <th>Score</th>
                <th>Map</th>
                <th>Adversaire</th>
                <th>Composition</th>
                <th>Date</th>
                {isAdmin && <th aria-label="Actions" />}
              </tr>
            </thead>
            <tbody>
              {matchList.map((match) => {
                const result = computeMatchResult(match)
                const meta = MATCH_RESULT_META[result]
                const map = mapByUuid.get(match.mapUuid)
                const comp = match.compositionId
                  ? Object.values(compositionsByMap[match.mapUuid] || {}).find((c) => c.id === match.compositionId)
                  : null

                return (
                  <tr key={match.id}>
                    <td>
                      <span className="match-result-badge" style={{ '--result-color': meta.color }}>
                        {meta.label}
                      </span>
                    </td>
                    <td className="match-history-table__score">
                      {match.ourScore} – {match.opponentScore}
                    </td>
                    <td>
                      <span className="match-history-table__map">
                        {map?.thumbnail && <img src={map.thumbnail} alt="" />}
                        {map?.name || 'Map inconnue'}
                      </span>
                    </td>
                    <td>{match.opponentName}</td>
                    <td>{comp ? comp.name : <span className="match-history-table__muted">—</span>}</td>
                    <td className="match-history-table__muted">
                      {match.matchDate
                        ? new Date(match.matchDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
                        : '—'}
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
              className="player-form glass-panel"
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
                <span>Adversaire</span>
                <input
                  type="text"
                  autoFocus
                  required
                  value={form.opponentName}
                  onChange={(e) => setForm((f) => ({ ...f, opponentName: e.target.value }))}
                  placeholder="Ex. Team Liquid"
                />
              </label>

              <label className="player-form__field">
                <span>Map</span>
                <select value={form.mapUuid} onChange={(e) => handleMapChange(e.target.value)} required>
                  <option value="">Choisir une map…</option>
                  {maps.map((m) => (
                    <option key={m.uuid} value={m.uuid}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="player-form__field">
                <span>Composition utilisée (optionnel)</span>
                <select
                  value={form.compositionId}
                  onChange={(e) => setForm((f) => ({ ...f, compositionId: e.target.value }))}
                  disabled={!form.mapUuid}
                >
                  <option value="">Aucune / non renseignée</option>
                  {compsForSelectedMap.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>

              {formMode === 'played' && (
                <div className="match-center__form-row">
                  <label className="player-form__field">
                    <span>Notre score</span>
                    <input
                      type="number"
                      min="0"
                      required
                      value={form.ourScore}
                      onChange={(e) => setForm((f) => ({ ...f, ourScore: e.target.value }))}
                      placeholder="13"
                    />
                  </label>
                  <label className="player-form__field">
                    <span>Score adverse</span>
                    <input
                      type="number"
                      min="0"
                      required
                      value={form.opponentScore}
                      onChange={(e) => setForm((f) => ({ ...f, opponentScore: e.target.value }))}
                      placeholder="7"
                    />
                  </label>
                </div>
              )}

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
