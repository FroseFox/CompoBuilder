import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useData } from '../../context/DataContext'
import { useCompositions } from '../../context/CompositionsContext'
import { usePlayers } from '../../context/PlayersContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { getCompsForMap } from '../../utils/compositions'
import AgentSlot from '../../components/AgentSlot/AgentSlot'
import AgentSelectionModal from '../../components/AgentSelectionModal/AgentSelectionModal'
import CompositionTabs from '../../components/CompositionTabs/CompositionTabs'
import StatusPicker, { StatusDot } from '../../components/StatusBadge/StatusBadge'
import NotesEditor from '../../components/NotesEditor/NotesEditor'
import RoleStats from '../../components/RoleStats/RoleStats'
import ConfirmDialog from '../../components/ConfirmDialog/ConfirmDialog'
import Loader from '../../components/Loader/Loader'
import './Editor.css'

export default function Editor() {
  const { mapId } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { maps, agents, status } = useData()
  const { players } = usePlayers()
  const { isAdmin } = useAuth()
  const { pushToast } = useToast()
  const {
    compositionsByMap,
    status: compsStatus,
    createComposition,
    duplicateComposition,
    deleteComposition,
    renameComposition,
    setMain,
    setStatus,
    setNotes,
    setSlotAgent,
    setSlotPlayer,
    removeSlot,
    reorderSlots,
    clearComposition,
  } = useCompositions()

  const [activeSlot, setActiveSlot] = useState(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [activeCompId, setActiveCompId] = useState(null)

  const map = useMemo(() => maps.find((m) => m.uuid === mapId), [maps, mapId])
  const comps = getCompsForMap(compositionsByMap, mapId)
  const agentByUuid = useMemo(() => new Map(agents.map((a) => [a.uuid, a])), [agents])

  // Garde une sélection d'onglet valide (deep-link ?comp=, composition
  // principale, ou première disponible). Seul un admin peut créer la toute
  // première composition d'une map : un visiteur en lecture seule voit un
  // message d'attente plutôt qu'une tentative d'écriture refusée.
  useEffect(() => {
    if (compsStatus !== 'ready' || !map) return
    const currentComps = getCompsForMap(compositionsByMap, mapId)

    if (currentComps.length === 0) {
      if (isAdmin) {
        createComposition(mapId, 'Composition principale').then(setActiveCompId)
      }
      return
    }

    if (!activeCompId || !currentComps.some((c) => c.id === activeCompId)) {
      const fromLink = currentComps.find((c) => c.id === searchParams.get('comp'))
      const main = currentComps.find((c) => c.isMain)
      setActiveCompId((fromLink || main || currentComps[0]).id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compsStatus, map, mapId, compositionsByMap, isAdmin])

  if (status === 'loading' || compsStatus === 'loading') {
    return (
      <main className="editor container">
        <Loader label="Chargement de la map…" />
      </main>
    )
  }

  if (status === 'ready' && !map) {
    return (
      <main className="editor container editor--not-found">
        <h2>Map introuvable</h2>
        <p>Cette map n'existe pas ou plus dans les données de l'API.</p>
        <Link to="/" className="btn btn-primary">
          Retour à l'accueil
        </Link>
      </main>
    )
  }

  const composition = comps.find((c) => c.id === activeCompId) || comps[0] || null

  const usedAgentUuids = new Set(composition ? composition.slots.filter((s) => s.agentUuid).map((s) => s.agentUuid) : [])

  const agentsInComp = composition
    ? composition.slots.filter((s) => s.agentUuid).map((s) => agentByUuid.get(s.agentUuid)).filter(Boolean)
    : []

  const filledCount = agentsInComp.length

  const handleSelectAgent = (agentUuid) => {
    setSlotAgent(mapId, composition.id, activeSlot, agentUuid)
    setActiveSlot(null)
  }

  const handleClear = () => {
    clearComposition(mapId, composition.id)
    setConfirmClear(false)
    pushToast('Composition vidée.', 'success')
  }

  const handleCreateComp = async () => {
    const name = `Composition ${comps.length + 1}`
    const newId = await createComposition(mapId, name)
    if (newId) {
      setActiveCompId(newId)
      pushToast('Nouvelle composition créée.', 'success')
    }
  }

  const handleDuplicate = async (compId) => {
    const newId = await duplicateComposition(mapId, compId)
    if (newId) {
      setActiveCompId(newId)
      pushToast('Composition dupliquée.', 'success')
    }
  }

  const handleDeleteComp = async () => {
    await deleteComposition(mapId, confirmDelete)
    setConfirmDelete(null)
    pushToast('Composition supprimée.', 'success')
  }

  return (
    <main className="editor">
      <div className="editor__banner">
        <img src={map?.image} alt="" className="editor__banner-image" />
        <div className="editor__banner-scrim" />
        <div className="container editor__banner-content">
          <button className="btn btn-ghost editor__back" onClick={() => navigate('/')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M19 12H5M11 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Toutes les maps
          </button>
          <h1 className="editor__title">{map?.name}</h1>
          <span className="editor__count">
            {filledCount}/5 agents sélectionnés sur cette composition
            {!isAdmin && ' · lecture seule'}
          </span>
        </div>
      </div>

      {!composition && (
        <div className="container editor__content">
          <div className="editor__section glass-panel editor__waiting">
            <p>Aucune composition n'a encore été créée pour cette map. Un administrateur doit s'y connecter pour en créer une.</p>
          </div>
        </div>
      )}

      {composition && (
        <div className="container editor__content">
          <section className="editor__section">
            <div className="editor__section-header">
              <h2>Compositions</h2>
              <p>
                {isAdmin
                  ? 'Créez plusieurs compositions par map (principale, anti-rush, eco…) et marquez celle à afficher sur l\'accueil.'
                  : 'Compositions disponibles pour cette map.'}
              </p>
            </div>
            <CompositionTabs
              comps={comps}
              activeCompId={composition.id}
              editable={isAdmin}
              onSelect={setActiveCompId}
              onCreate={handleCreateComp}
              onRename={(id, name) => renameComposition(mapId, id, name)}
              onSetMain={(id) => setMain(mapId, id)}
              onDuplicate={handleDuplicate}
              onDelete={(id) => setConfirmDelete(id)}
            />
          </section>

          <section className="editor__section">
            <div className="editor__section-header">
              <h2>Composition — {composition.name}</h2>
              <p>
                {isAdmin
                  ? 'Cliquez sur un emplacement pour choisir un agent, glissez-déposez pour réorganiser, et assignez un joueur.'
                  : 'Agents et joueurs assignés pour cette composition.'}
              </p>
            </div>

            <div className="editor__slots">
              {composition.slots.map((slot, index) => (
                <AgentSlot
                  key={`${composition.id}-${index}`}
                  index={index}
                  agent={slot.agentUuid ? agentByUuid.get(slot.agentUuid) : null}
                  playerId={slot.playerId}
                  players={players}
                  editable={isAdmin}
                  onOpenSelection={setActiveSlot}
                  onRemove={(i) => removeSlot(mapId, composition.id, i)}
                  onReorder={(from, to) => reorderSlots(mapId, composition.id, from, to)}
                  onAssignPlayer={(i, playerId) => setSlotPlayer(mapId, composition.id, i, playerId)}
                />
              ))}
            </div>

            {isAdmin && (
              <div className="editor__actions">
                <button
                  className="btn btn-danger"
                  onClick={() => setConfirmClear(true)}
                  disabled={filledCount === 0}
                >
                  Vider la composition
                </button>
              </div>
            )}
          </section>

          <div className="editor__grid-two">
            <section className="editor__section">
              <div className="editor__section-header">
                <h2>Statut</h2>
                <p>Où en est cette composition ?</p>
              </div>
              {isAdmin ? (
                <StatusPicker value={composition.status} onChange={(s) => setStatus(mapId, composition.id, s)} />
              ) : (
                <StatusDot status={composition.status} />
              )}
            </section>

            <section className="editor__section">
              <div className="editor__section-header">
                <h2>Répartition des rôles</h2>
                <p>Un aperçu de l'équilibre de cette composition.</p>
              </div>
              <RoleStats agentsInComp={agentsInComp} />
            </section>
          </div>

          <section className="editor__section">
            <div className="editor__section-header">
              <h2>Notes</h2>
              <p>Stratégie, calls, timings, erreurs à éviter — sauvegardé automatiquement.</p>
            </div>
            {isAdmin ? (
              <NotesEditor
                key={composition.id}
                value={composition.notes}
                onSave={(text) => setNotes(mapId, composition.id, text)}
              />
            ) : (
              <div className="editor__notes-readonly glass-panel">
                {composition.notes ? (
                  <p>{composition.notes}</p>
                ) : (
                  <p className="editor__notes-empty">Aucune note pour cette composition.</p>
                )}
              </div>
            )}
          </section>
        </div>
      )}

      <AgentSelectionModal
        open={activeSlot !== null}
        agents={agents}
        usedAgentUuids={usedAgentUuids}
        currentAgentUuid={activeSlot !== null && composition ? composition.slots[activeSlot].agentUuid : null}
        onSelect={handleSelectAgent}
        onClose={() => setActiveSlot(null)}
      />

      <ConfirmDialog
        open={confirmClear}
        title="Vider cette composition ?"
        description={`Les ${filledCount} agent(s) sélectionné(s) pour « ${composition?.name} » seront retirés.`}
        confirmLabel="Vider"
        onConfirm={handleClear}
        onCancel={() => setConfirmClear(false)}
      />

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title="Supprimer cette composition ?"
        description="Cette composition et ses notes seront définitivement supprimées."
        confirmLabel="Supprimer"
        onConfirm={handleDeleteComp}
        onCancel={() => setConfirmDelete(null)}
      />
    </main>
  )
}
