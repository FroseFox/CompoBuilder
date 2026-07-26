import { useState } from 'react'
import { motion } from 'framer-motion'
import RoleBadge from '../RoleBadge/RoleBadge'
import PlayerSelect from '../PlayerSelect/PlayerSelect'
import PlayerAvatar from '../PlayerAvatar/PlayerAvatar'
import './AgentSlot.css'

export default function AgentSlot({
  index,
  agent,
  playerId,
  players,
  editable = true,
  onOpenSelection,
  onRemove,
  onReorder,
  onAssignPlayer,
}) {
  const [isDragOver, setIsDragOver] = useState(false)
  const player = playerId ? players[playerId] : null

  const handleDragStart = (e) => {
    if (!agent || !editable) return e.preventDefault()
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(index))
  }

  const handleDragOver = (e) => {
    if (!editable) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setIsDragOver(true)
  }

  const handleDrop = (e) => {
    if (!editable) return
    e.preventDefault()
    setIsDragOver(false)
    const fromIndex = Number(e.dataTransfer.getData('text/plain'))
    if (!Number.isNaN(fromIndex) && fromIndex !== index) {
      onReorder(fromIndex, index)
    }
  }

  return (
    <motion.div
      layout
      className={`agent-slot ${agent ? 'agent-slot--filled' : 'agent-slot--empty'} ${
        isDragOver ? 'agent-slot--drag-over' : ''
      } ${!editable ? 'agent-slot--readonly' : ''}`}
      draggable={editable && Boolean(agent)}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
    >
      <span className="agent-slot__index">{`0${index + 1}`}</span>

      {agent ? (
        <>
          {editable && (
            <button
              type="button"
              className="agent-slot__remove"
              onClick={() => onRemove(index)}
              aria-label={`Retirer ${agent.name} de la composition`}
              title="Retirer"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
              </svg>
            </button>
          )}

          {editable ? (
            <button
              type="button"
              className="agent-slot__portrait-btn"
              onClick={() => onOpenSelection(index)}
              aria-label={`Remplacer ${agent.name}`}
            >
              <img src={agent.portrait} alt={agent.name} className="agent-slot__portrait" />
            </button>
          ) : (
            <div className="agent-slot__portrait-btn">
              <img src={agent.portrait} alt={agent.name} className="agent-slot__portrait" />
            </div>
          )}

          <div className="agent-slot__info">
            <span className="agent-slot__name">{agent.name}</span>
            <RoleBadge role={agent.role} size="sm" />
            {editable ? (
              <div draggable={false} onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
                <PlayerSelect
                  players={players}
                  value={playerId}
                  onChange={(id) => onAssignPlayer(index, id)}
                  label={`Joueur pour ${agent.name}`}
                />
              </div>
            ) : (
              <span className="agent-slot__player-readonly">
                <PlayerAvatar player={player} size="sm" />
                {player ? player.pseudo : 'Aucun joueur'}
              </span>
            )}
          </div>

          {editable && (
            <span className="agent-slot__drag-hint" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <circle cx="9" cy="6" r="1.4" fill="currentColor" />
                <circle cx="15" cy="6" r="1.4" fill="currentColor" />
                <circle cx="9" cy="12" r="1.4" fill="currentColor" />
                <circle cx="15" cy="12" r="1.4" fill="currentColor" />
                <circle cx="9" cy="18" r="1.4" fill="currentColor" />
                <circle cx="15" cy="18" r="1.4" fill="currentColor" />
              </svg>
            </span>
          )}
        </>
      ) : editable ? (
        <button
          type="button"
          className="agent-slot__add"
          onClick={() => onOpenSelection(index)}
          aria-label={`Ajouter un agent à l'emplacement ${index + 1}`}
        >
          <span className="agent-slot__add-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </span>
          <span className="agent-slot__add-label">Ajouter</span>
        </button>
      ) : (
        <div className="agent-slot__add agent-slot__add--static">
          <span className="agent-slot__add-label">Vide</span>
        </div>
      )}
    </motion.div>
  )
}
