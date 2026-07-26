import { useMemo, useState } from 'react'
import { useData } from '../../context/DataContext'
import { usePlayers } from '../../context/PlayersContext'
import { useCompositions } from '../../context/CompositionsContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { PLAYER_COLORS } from '../../utils/storage'
import PlayerAvatar from '../../components/PlayerAvatar/PlayerAvatar'
import RoleBadge from '../../components/RoleBadge/RoleBadge'
import ConfirmDialog from '../../components/ConfirmDialog/ConfirmDialog'
import { AnimatePresence, motion } from 'framer-motion'
import './Team.css'

const emptyForm = { pseudo: '', primaryRole: '', secondaryRole: '', color: PLAYER_COLORS[0] }

export default function Team() {
  const { agents } = useData()
  const { players, addPlayer, updatePlayer, deletePlayer } = usePlayers()
  const { unassignPlayerEverywhere } = useCompositions()
  const { isAdmin } = useAuth()
  const { pushToast } = useToast()

  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)

  const roles = useMemo(() => {
    const map = new Map()
    agents.forEach((a) => map.set(a.role.name, a.role))
    return [...map.values()]
  }, [agents])

  const playerList = useMemo(
    () => Object.values(players).sort((a, b) => a.pseudo.localeCompare(b.pseudo)),
    [players]
  )

  const openCreate = () => {
    setEditingId(null)
    setForm(emptyForm)
    setFormOpen(true)
  }

  const openEdit = (player) => {
    setEditingId(player.id)
    setForm({
      pseudo: player.pseudo,
      primaryRole: player.primaryRole || '',
      secondaryRole: player.secondaryRole || '',
      color: player.color,
    })
    setFormOpen(true)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const pseudo = form.pseudo.trim()
    if (!pseudo) return

    const payload = {
      pseudo,
      primaryRole: form.primaryRole || null,
      secondaryRole: form.secondaryRole || null,
      color: form.color,
    }

    if (editingId) {
      updatePlayer(editingId, payload)
      pushToast(`${pseudo} mis à jour.`, 'success')
    } else {
      addPlayer(payload)
      pushToast(`${pseudo} ajouté à l'effectif.`, 'success')
    }
    setFormOpen(false)
  }

  const handleDelete = async () => {
    const player = players[confirmDeleteId]
    setConfirmDeleteId(null)
    await unassignPlayerEverywhere(confirmDeleteId)
    await deletePlayer(confirmDeleteId)
    pushToast(`${player?.pseudo || 'Joueur'} retiré de l'effectif.`, 'success')
  }

  return (
    <main className="team-page container">
      <div className="team-page__header">
        <div>
          <span className="home__eyebrow">Effectif</span>
          <h1 className="team-page__title">Votre équipe</h1>
          <p>Gérez les joueurs, leurs rôles et leur couleur d'identification.</p>
        </div>
        {isAdmin && (
          <button className="btn btn-primary" onClick={openCreate}>
            + Ajouter un joueur
          </button>
        )}
      </div>

      {!isAdmin && (
        <div className="team-page__readonly-notice">
          Mode consultation — connectez-vous en tant qu'administrateur pour modifier l'effectif.
        </div>
      )}

      {playerList.length === 0 ? (
        <div className="team-page__empty glass-panel">
          <p>Aucun joueur pour le moment. Ajoutez votre effectif pour pouvoir l'assigner aux compositions.</p>
        </div>
      ) : (
        <div className="team-page__grid">
          {playerList.map((player) => (
            <div key={player.id} className="player-card glass-panel">
              <PlayerAvatar player={player} size="lg" />
              <div className="player-card__info">
                <h3>{player.pseudo}</h3>
                <div className="player-card__roles">
                  {player.primaryRole && <RoleBadge role={roles.find((r) => r.name === player.primaryRole)} size="sm" />}
                  {player.secondaryRole && (
                    <RoleBadge role={roles.find((r) => r.name === player.secondaryRole)} size="sm" />
                  )}
                  {!player.primaryRole && !player.secondaryRole && (
                    <span className="player-card__no-role">Aucun rôle défini</span>
                  )}
                </div>
              </div>
              {isAdmin && (
                <div className="player-card__actions">
                  <button className="btn btn-ghost btn-icon" onClick={() => openEdit(player)} aria-label={`Modifier ${player.pseudo}`}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                      <path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                    </svg>
                  </button>
                  <button
                    className="btn btn-ghost btn-icon"
                    onClick={() => setConfirmDeleteId(player.id)}
                    aria-label={`Supprimer ${player.pseudo}`}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                      <path d="M5 7h14M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-9 0 1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          ))}
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
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              onSubmit={handleSubmit}
            >
              <h3>{editingId ? 'Modifier le joueur' : 'Ajouter un joueur'}</h3>

              <label className="player-form__field">
                <span>Pseudo</span>
                <input
                  type="text"
                  autoFocus
                  required
                  value={form.pseudo}
                  onChange={(e) => setForm((f) => ({ ...f, pseudo: e.target.value }))}
                  placeholder="Ex. Lucas"
                />
              </label>

              <label className="player-form__field">
                <span>Rôle principal</span>
                <select
                  value={form.primaryRole}
                  onChange={(e) => setForm((f) => ({ ...f, primaryRole: e.target.value }))}
                >
                  <option value="">—</option>
                  {roles.map((r) => (
                    <option key={r.name} value={r.name}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="player-form__field">
                <span>Rôle secondaire</span>
                <select
                  value={form.secondaryRole}
                  onChange={(e) => setForm((f) => ({ ...f, secondaryRole: e.target.value }))}
                >
                  <option value="">—</option>
                  {roles.map((r) => (
                    <option key={r.name} value={r.name}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="player-form__field">
                <span>Couleur d'identification</span>
                <div className="player-form__colors">
                  {PLAYER_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={`player-form__swatch ${form.color === color ? 'player-form__swatch--active' : ''}`}
                      style={{ '--swatch-color': color }}
                      onClick={() => setForm((f) => ({ ...f, color }))}
                      aria-label={`Choisir la couleur ${color}`}
                    />
                  ))}
                </div>
              </div>

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
        title="Retirer ce joueur ?"
        description="Il sera retiré de l'effectif et désassigné de toutes les compositions où il apparaissait."
        confirmLabel="Retirer"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </main>
  )
}
