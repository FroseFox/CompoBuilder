import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { StatusDot } from '../StatusBadge/StatusBadge'
import RoleBadge from '../RoleBadge/RoleBadge'
import PlayerAvatar from '../PlayerAvatar/PlayerAvatar'
import './CompositionCompareModal.css'

/** Une colonne compacte : nom + statut + 5 lignes agent/joueur, en lecture seule. */
function CompareColumn({ comps, value, onChange, agentByUuid, players }) {
  const comp = comps.find((c) => c.id === value)

  return (
    <div className="compare-col">
      <select className="compare-col__select" value={value || ''} onChange={(e) => onChange(e.target.value)}>
        {comps.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      {comp && (
        <>
          <StatusDot status={comp.status} size="sm" />
          <div className="compare-col__slots">
            {comp.slots.map((slot, i) => {
              const agent = slot.agentUuid ? agentByUuid.get(slot.agentUuid) : null
              const player = slot.playerId ? players[slot.playerId] : null
              return (
                <div key={i} className={`compare-row ${!agent ? 'compare-row--empty' : ''}`}>
                  {agent ? (
                    <img src={agent.icon} alt="" className="compare-row__icon" />
                  ) : (
                    <span className="compare-row__icon compare-row__icon--empty" aria-hidden="true" />
                  )}
                  <div className="compare-row__info">
                    <span className="compare-row__name">{agent ? agent.name : 'Vide'}</span>
                    {agent && <RoleBadge role={agent.role} size="sm" />}
                  </div>
                  <div className="compare-row__player">
                    <PlayerAvatar player={player} size="sm" />
                    <span>{player ? player.pseudo : '—'}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

export default function CompositionCompareModal({ open, onClose, comps, agentByUuid, players }) {
  const [leftId, setLeftId] = useState(null)
  const [rightId, setRightId] = useState(null)

  // Choisit deux compositions différentes par défaut à chaque ouverture.
  useEffect(() => {
    if (!open) return
    setLeftId(comps[0]?.id || null)
    setRightId((comps.find((c) => c.id !== comps[0]?.id) || comps[0])?.id || null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="confirm-scrim"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          onClick={onClose}
        >
          <motion.div
            className="compare-modal glass-panel"
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 420, damping: 32 } }}
            exit={{ opacity: 0, y: 10, scale: 0.98, transition: { duration: 0.15 } }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="compare-modal__header">
              <h3>Comparer deux compositions</h3>
              <button type="button" className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Fermer">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className="compare-modal__grid">
              <CompareColumn comps={comps} value={leftId} onChange={setLeftId} agentByUuid={agentByUuid} players={players} />
              <CompareColumn comps={comps} value={rightId} onChange={setRightId} agentByUuid={agentByUuid} players={players} />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
