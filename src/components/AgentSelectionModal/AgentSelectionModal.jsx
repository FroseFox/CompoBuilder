import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import RoleBadge from '../RoleBadge/RoleBadge'
import './AgentSelectionModal.css'

export default function AgentSelectionModal({
  open,
  agents,
  usedAgentUuids,
  currentAgentUuid,
  onSelect,
  onClose,
}) {
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [sortAsc, setSortAsc] = useState(true)

  const roles = useMemo(() => {
    const set = new Map()
    agents.forEach((a) => set.set(a.role.name, a.role))
    return [...set.values()]
  }, [agents])

  const filteredAgents = useMemo(() => {
    let list = agents.filter((agent) =>
      agent.name.toLowerCase().includes(search.trim().toLowerCase())
    )
    if (roleFilter !== 'all') {
      list = list.filter((agent) => agent.role.name === roleFilter)
    }
    list = [...list].sort((a, b) =>
      sortAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
    )
    return list
  }, [agents, search, roleFilter, sortAsc])

  const handleClose = () => {
    setSearch('')
    setRoleFilter('all')
    onClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="agent-modal-scrim"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={handleClose}
        >
          <motion.div
            className="agent-modal glass-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Sélection d'un agent"
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="agent-modal__header">
              <h3>Choisir un agent</h3>
              <button className="btn btn-ghost btn-icon" onClick={handleClose} aria-label="Fermer">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className="agent-modal__controls">
              <div className="agent-modal__search">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                  <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <input
                  type="text"
                  placeholder="Rechercher un agent…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label="Rechercher un agent"
                />
              </div>

              <button
                type="button"
                className="btn btn-ghost agent-modal__sort"
                onClick={() => setSortAsc((s) => !s)}
                title="Trier alphabétiquement"
              >
                A–Z
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  style={{ transform: sortAsc ? 'none' : 'rotate(180deg)', transition: 'transform 200ms' }}
                >
                  <path d="M12 19V5M6 11l6-6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>

            <div className="agent-modal__roles">
              <button
                className={`role-chip ${roleFilter === 'all' ? 'role-chip--active' : ''}`}
                onClick={() => setRoleFilter('all')}
              >
                Tous
              </button>
              {roles.map((role) => (
                <button
                  key={role.name}
                  className={`role-chip ${roleFilter === role.name ? 'role-chip--active' : ''}`}
                  onClick={() => setRoleFilter(role.name)}
                >
                  {role.name}
                </button>
              ))}
            </div>

            <div className="agent-modal__grid">
              {filteredAgents.length === 0 && (
                <p className="agent-modal__empty">Aucun agent ne correspond à cette recherche.</p>
              )}
              {filteredAgents.map((agent) => {
                const isUsedElsewhere =
                  usedAgentUuids.has(agent.uuid) && agent.uuid !== currentAgentUuid
                const isCurrent = agent.uuid === currentAgentUuid

                return (
                  <button
                    key={agent.uuid}
                    type="button"
                    className={`agent-pick ${isCurrent ? 'agent-pick--current' : ''} ${
                      isUsedElsewhere ? 'agent-pick--disabled' : ''
                    }`}
                    disabled={isUsedElsewhere}
                    onClick={() => onSelect(agent.uuid)}
                  >
                    <img src={agent.icon} alt="" className="agent-pick__icon" />
                    <span className="agent-pick__name">{agent.name}</span>
                    <RoleBadge role={agent.role} size="sm" />
                    {isUsedElsewhere && <span className="agent-pick__tag">Déjà utilisé</span>}
                    {isCurrent && <span className="agent-pick__tag agent-pick__tag--current">Actuel</span>}
                  </button>
                )
              })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
