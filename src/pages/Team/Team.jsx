import { useEffect, useMemo, useState } from 'react'
import { useData } from '../../context/DataContext'
import { usePlayers } from '../../context/PlayersContext'
import { useCompositions } from '../../context/CompositionsContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { PLAYER_COLORS, FLEX_ROLE } from '../../utils/storage'
import { fetchTeamAccess, setPlayerAdminRow } from '../../services/db'
import { networkUrl } from '../../services/team'
import { importLegacyData } from '../../services/importLegacy'
import PlayerAvatar from '../../components/PlayerAvatar/PlayerAvatar'
import RoleBadge from '../../components/RoleBadge/RoleBadge'
import ConfirmDialog from '../../components/ConfirmDialog/ConfirmDialog'
import { AnimatePresence, motion } from 'framer-motion'
import './Team.css'

const emptyForm = { pseudo: '', primaryRole: '', secondaryRole: '', color: PLAYER_COLORS[0] }

const ROLE_ACCENT = {
  Duelist: 'var(--role-duelist)',
  Duelliste: 'var(--role-duelist)',
  Controller: 'var(--role-controller)',
  Contrôleur: 'var(--role-controller)',
  Initiator: 'var(--role-initiator)',
  Initiateur: 'var(--role-initiator)',
  Sentinel: 'var(--role-sentinel)',
  Sentinelle: 'var(--role-sentinel)',
  Flex: 'var(--role-flex)',
}

export default function Team() {
  const { agents } = useData()
  const { players, addPlayer, updatePlayer, deletePlayer } = usePlayers()
  const { unassignPlayerEverywhere, compositionsByMap } = useCompositions()
  const { isAdmin, isCaptain, user, team } = useAuth()
  const { pushToast } = useToast()

  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)

  const [roleFilter, setRoleFilter] = useState('all')

  // Qui peut modifier : le capitaine + les éditeurs qu'il a nommés.
  // (Liste visible par toute l'équipe ; seul le capitaine la change.)
  const [editorUserIds, setEditorUserIds] = useState(() => new Set())
  const [captainId, setCaptainId] = useState(null)

  useEffect(() => {
    let cancelled = false
    fetchTeamAccess()
      .then(({ captainId: cap, editorUserIds: ids }) => {
        if (cancelled) return
        setCaptainId(cap)
        setEditorUserIds(ids)
      })
      .catch((err) => console.error(err))
    return () => {
      cancelled = true
    }
  }, [team])

  const handleToggleAdmin = async (player) => {
    const makeAdmin = !editorUserIds.has(player.userId)
    try {
      await setPlayerAdminRow(player.userId, makeAdmin)
      setEditorUserIds((prev) => {
        const next = new Set(prev)
        if (makeAdmin) next.add(player.userId)
        else next.delete(player.userId)
        return next
      })
      pushToast(
        makeAdmin ? `${player.pseudo} peut maintenant modifier le Comp Builder.` : `${player.pseudo} passe en lecture seule.`,
        'success'
      )
    } catch (err) {
      console.error(err)
      pushToast("Impossible de modifier ce droit. Seul le capitaine peut nommer les éditeurs.", 'error')
    }
  }

  // Reprise des données de l'ancien Comp Builder (une seule fois)
  const [legacyKey, setLegacyKey] = useState('')
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState('')
  const handleImport = async () => {
    if (importing) return
    const existing = Object.values(compositionsByMap).reduce((n, b) => n + Object.keys(b || {}).length, 0)
    if (existing > 0 && !window.confirm(`Il y a déjà ${existing} composition(s). Les anciennes seront ajoutées en plus. Continuer ?`)) return
    setImporting(true)
    setImportMsg('')
    try {
      const r = await importLegacyData({ key: legacyKey, onProgress: setImportMsg })
      setImportMsg(`Terminé : ${r.compositions} compositions et ${r.players} joueurs repris.`)
      setLegacyKey('')
      pushToast('Anciennes compositions importées.', 'success')
    } catch (err) {
      console.error(err)
      setImportMsg(err.message || 'Import impossible.')
    } finally {
      setImporting(false)
    }
  }

  const roles = useMemo(() => {
    const map = new Map()
    agents.forEach((a) => map.set(a.role.name, a.role))
    map.set(FLEX_ROLE.name, FLEX_ROLE)
    return [...map.values()]
  }, [agents])

  const playerList = useMemo(
    () => Object.values(players).sort((a, b) => a.pseudo.localeCompare(b.pseudo)),
    [players]
  )

  const visiblePlayers = useMemo(() => {
    if (roleFilter === 'all') return playerList
    return playerList.filter((p) => p.primaryRole === roleFilter || p.secondaryRole === roleFilter)
  }, [playerList, roleFilter])

  const roleCounts = useMemo(() => {
    const counts = new Map(roles.map((r) => [r.name, 0]))
    playerList.forEach((p) => {
      if (p.primaryRole && counts.has(p.primaryRole)) counts.set(p.primaryRole, counts.get(p.primaryRole) + 1)
      if (p.secondaryRole && counts.has(p.secondaryRole)) counts.set(p.secondaryRole, counts.get(p.secondaryRole) + 1)
    })
    return counts
  }, [roles, playerList])

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
    // Seules les fiches ajoutées à la main se suppriment ici : un membre
    // de l'équipe se retire depuis « Mon équipe » sur le site du réseau.
    await deletePlayer(confirmDeleteId)
    pushToast(`${player?.pseudo || 'Joueur'} retiré de l'effectif.`, 'success')
  }

  return (
    <main className="team-page container">
      <div className="team-page__header">
        <div>
          <span className="home__eyebrow">Effectif</span>
          <h1 className="team-page__title">Votre équipe</h1>
          <p>
            Les membres de {team?.name || "l'équipe"} arrivent ici automatiquement. Réglez leurs rôles et leur
            couleur, ou ajoutez un coach ou un remplaçant hors réseau.{' '}
            <a href={networkUrl('#/mon-equipe')}>Gérer le roster sur le réseau</a>
          </p>
        </div>
        {isAdmin && (
          <button className="btn btn-primary" onClick={openCreate}>
            + Ajouter un joueur
          </button>
        )}
      </div>

      {!isAdmin && (
        <div className="team-page__readonly-notice">
          Lecture seule : le capitaine et les éditeurs qu'il nomme peuvent modifier. Tu peux quand même régler
          tes propres rôles et ta couleur.
        </div>
      )}

      {playerList.length > 0 && (
        <div className="dashboard__stat-grid team-page__stats">
          {roles.map((r) => (
            <button
              key={r.name}
              type="button"
              className={`stat-card accent-card team-page__stat-btn ${roleFilter === r.name ? 'team-page__stat-btn--active' : ''}`}
              style={{ '--accent-card-color': ROLE_ACCENT[r.name] || 'var(--brand-red)' }}
              onClick={() => setRoleFilter((prev) => (prev === r.name ? 'all' : r.name))}
              aria-pressed={roleFilter === r.name}
            >
              <span className="stat-card__value">{roleCounts.get(r.name) || 0}</span>
              <span className="stat-card__label">{r.name}</span>
            </button>
          ))}
        </div>
      )}

      {playerList.length > 0 && roleFilter !== 'all' && (
        <div className="team-page__filter">
          <span>Filtré sur « {roleFilter} »</span>
          <button className="btn btn-ghost" onClick={() => setRoleFilter('all')}>
            Réinitialiser
          </button>
        </div>
      )}

      {playerList.length === 0 ? (
        <div className="team-page__empty glass-panel">
          <p>Aucun joueur pour le moment. Ajoutez votre effectif pour pouvoir l'assigner aux compositions.</p>
        </div>
      ) : visiblePlayers.length === 0 ? (
        <div className="team-page__empty glass-panel">
          <p>Aucun joueur ne correspond à ce rôle.</p>
        </div>
      ) : (
        <div className="team-page__grid">
          <AnimatePresence>
            {visiblePlayers.map((player, index) => (
              <motion.div
                key={player.id}
                className="player-card glass-panel accent-card"
                style={{ '--accent-card-color': player.color || 'var(--brand-red)' }}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.32, delay: Math.min(index * 0.04, 0.3), ease: [0.16, 1, 0.3, 1] }}
              >
                <PlayerAvatar player={player} size="lg" showDiscordBadge />
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
                  {player.userId && player.userId === captainId && (
                    <span className="player-card__no-role">Capitaine</span>
                  )}
                  {player.userId && player.userId !== captainId && editorUserIds.has(player.userId) && (
                    <span className="player-card__no-role">Éditeur</span>
                  )}
                  {!player.userId && (
                    <span className="player-card__no-role" title="Fiche ajoutée à la main, pas membre de l'équipe sur le réseau">
                      Hors réseau
                    </span>
                  )}
                </div>
                {(isAdmin || player.userId === user?.id) && (
                  <div className="player-card__actions">
                    {isCaptain && player.userId && player.userId !== captainId && (
                      <button
                        type="button"
                        className={`btn btn-ghost btn-icon player-card__admin-btn ${
                          editorUserIds.has(player.userId) ? 'player-card__admin-btn--active' : ''
                        }`}
                        onClick={() => handleToggleAdmin(player)}
                        title={
                          editorUserIds.has(player.userId)
                            ? 'Éditeur : peut modifier le Comp Builder. Cliquer pour retirer'
                            : 'Nommer éditeur (peut modifier compos, matchs et effectif)'
                        }
                        aria-label={
                          editorUserIds.has(player.userId)
                            ? `Retirer le droit d'édition à ${player.pseudo}`
                            : `Nommer ${player.pseudo} éditeur`
                        }
                        aria-pressed={editorUserIds.has(player.userId)}
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill={editorUserIds.has(player.userId) ? 'currentColor' : 'none'}>
                          <path
                            d="M12 2.5 14.6 8.6l6.6.6-5 4.4 1.5 6.5L12 16.9l-5.7 3.2 1.5-6.5-5-4.4 6.6-.6Z"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                    )}
                    <button className="btn btn-ghost btn-icon" onClick={() => openEdit(player)} aria-label={`Modifier ${player.pseudo}`}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                        <path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                      </svg>
                    </button>
                    {isAdmin && !player.userId && (
                    <button
                      className="btn btn-ghost btn-icon"
                      onClick={() => setConfirmDeleteId(player.id)}
                      aria-label={`Supprimer ${player.pseudo}`}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                        <path d="M5 7h14M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-9 0 1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                    )}
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
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

      {isAdmin && (
        <details className="team-page__import glass-panel">
          <summary>Reprendre les compos de l'ancien Comp Builder</summary>
          <p>
            À faire une seule fois. Dans l'ancien projet Supabase : Project Settings → API Keys, copie la clé
            « anon public » et colle-la ici. Les compositions et l'effectif sont copiés, l'ancien projet n'est
            pas modifié.
          </p>
          <div className="team-page__import-row">
            <input
              type="password"
              autoComplete="off"
              placeholder="Clé anon de l'ancien projet"
              aria-label="Clé anon de l'ancien projet"
              value={legacyKey}
              onChange={(e) => setLegacyKey(e.target.value)}
            />
            <button type="button" className="btn btn-ghost" onClick={handleImport} disabled={!legacyKey.trim() || importing}>
              {importing ? 'Import…' : 'Importer'}
            </button>
          </div>
          {importMsg && <p role="status">{importMsg}</p>}
        </details>
      )}

      <ConfirmDialog
        open={Boolean(confirmDeleteId)}
        title="Retirer ce joueur ?"
        description={
          "Cette fiche ajoutée à la main sera supprimée et retirée de toutes les compositions où elle apparaissait."
        }
        confirmLabel="Retirer"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </main>
  )
}
