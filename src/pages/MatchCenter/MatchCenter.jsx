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
import { computeMatchResult, MATCH_RESULT_META } from '../../utils/matches'
import { sendDiscordMessage, matchResultEmbed } from '../../utils/discordWebhook'
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
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)

  const mapByUuid = useMemo(() => new Map(maps.map((m) => [m.uuid, m])), [maps])

  const matchList = useMemo(
    () =>
      Object.values(matches).sort((a, b) => {
        if (a.matchDate && b.matchDate) return b.matchDate.localeCompare(a.matchDate)
        if (a.matchDate) return -1
        if (b.matchDate) return 1
        return b.createdAt - a.createdAt
      }),
    [matches]
  )

  const compsForSelectedMap = useMemo(
    () => (form.mapUuid ? getCompsForMap(compositionsByMap, form.mapUuid) : []),
    [compositionsByMap, form.mapUuid]
  )

  const openCreate = () => {
    setEditingId(null)
    setForm(emptyForm)
    setFormOpen(true)
  }

  const openEdit = (match) => {
    setEditingId(match.id)
    setForm({
      opponentName: match.opponentName,
      mapUuid: match.mapUuid,
      compositionId: match.compositionId || '',
      ourScore: String(match.ourScore),
      opponentScore: String(match.opponentScore),
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

    const payload = {
      opponentName: form.opponentName.trim(),
      mapUuid: form.mapUuid,
      compositionId: form.compositionId || null,
      ourScore: Number(form.ourScore) || 0,
      opponentScore: Number(form.opponentScore) || 0,
      matchDate: form.matchDate || null,
      notes: form.notes.trim(),
    }

    if (editingId) {
      await updateMatch(editingId, payload)
      pushToast('Match mis à jour.', 'success')
    } else {
      const id = await createMatch(payload)
      if (id) {
        pushToast('Match enregistré.', 'success')
        // Notification Discord "best effort" : ne bloque jamais l'UI et
        // n'affiche pas d'erreur si elle échoue (webhook non configuré,
        // Discord injoignable…) — l'enregistrement du match a déjà réussi.
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
          <p>L'historique de vos matchs joués : score, map, adversaire et composition utilisée.</p>
        </div>
        {matchList.length > 0 && (
          <div className="match-center__header-actions">
            <Link to="/stats" className="btn btn-ghost">
              Voir les statistiques
            </Link>
            {isAdmin && (
              <button className="btn btn-primary" onClick={openCreate}>
                + Ajouter un match
              </button>
            )}
          </div>
        )}
        {matchList.length === 0 && isAdmin && (
          <button className="btn btn-primary" onClick={openCreate}>
            + Ajouter un match
          </button>
        )}
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

      {status === 'ready' && matchList.length === 0 && (
        <div className="match-center__empty glass-panel">
          <p>
            {isAdmin
              ? 'Aucun match enregistré pour le moment. Ajoutez votre premier match joué.'
              : "Aucun match n'a encore été enregistré."}
          </p>
        </div>
      )}

      {status === 'ready' && matchList.length > 0 && (
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
              <h3>{editingId ? 'Modifier le match' : 'Ajouter un match'}</h3>

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

              <label className="player-form__field">
                <span>Date (optionnel)</span>
                <input
                  type="date"
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
                  {editingId ? 'Enregistrer' : 'Ajouter'}
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
