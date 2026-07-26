import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useData } from '../../context/DataContext'
import { useCompositions } from '../../context/CompositionsContext'
import { usePlayers } from '../../context/PlayersContext'
import { getCompsForMap } from '../../utils/compositions'
import PlayerAvatar from '../PlayerAvatar/PlayerAvatar'
import './GlobalSearch.css'

export default function GlobalSearch({ open, onClose }) {
  const [query, setQuery] = useState('')
  const { maps, agents } = useData()
  const { compositionsByMap } = useCompositions()
  const { players } = usePlayers()
  const navigate = useNavigate()

  const q = query.trim().toLowerCase()

  const mapResults = useMemo(() => {
    if (!q) return []
    return maps.filter((m) => m.name.toLowerCase().includes(q)).slice(0, 6)
  }, [maps, q])

  const playerResults = useMemo(() => {
    if (!q) return []
    return Object.values(players)
      .filter((p) => p.pseudo.toLowerCase().includes(q))
      .slice(0, 6)
  }, [players, q])

  const agentResults = useMemo(() => {
    if (!q) return []
    const matchedAgents = agents.filter((a) => a.name.toLowerCase().includes(q))
    const rows = []
    matchedAgents.forEach((agent) => {
      maps.forEach((map) => {
        getCompsForMap(compositionsByMap, map.uuid).forEach((comp) => {
          if (comp.slots.some((s) => s.agentUuid === agent.uuid)) {
            rows.push({ agent, map, comp })
          }
        })
      })
    })
    return rows.slice(0, 8)
  }, [agents, maps, compositionsByMap, q])

  const hasResults = mapResults.length || playerResults.length || agentResults.length

  const go = (path) => {
    navigate(path)
    setQuery('')
    onClose()
  }

  const handleClose = () => {
    setQuery('')
    onClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="gsearch-scrim"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={handleClose}
        >
          <motion.div
            className="gsearch glass-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Recherche globale"
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.99 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="gsearch__input">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <input
                autoFocus
                type="text"
                placeholder="Rechercher une map, un joueur, un agent…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Escape' && handleClose()}
              />
              <kbd>Esc</kbd>
            </div>

            {q && !hasResults && (
              <p className="gsearch__empty">Aucun résultat pour « {query} ».</p>
            )}

            {mapResults.length > 0 && (
              <div className="gsearch__group">
                <span className="gsearch__group-title">Maps</span>
                {mapResults.map((m) => (
                  <button key={m.uuid} className="gsearch__row" onClick={() => go(`/editor/${m.uuid}`)}>
                    <img src={m.thumbnail} alt="" className="gsearch__row-thumb" />
                    <span>{m.name}</span>
                  </button>
                ))}
              </div>
            )}

            {playerResults.length > 0 && (
              <div className="gsearch__group">
                <span className="gsearch__group-title">Joueurs</span>
                {playerResults.map((p) => (
                  <button key={p.id} className="gsearch__row" onClick={() => go('/team')}>
                    <PlayerAvatar player={p} size="sm" />
                    <span>{p.pseudo}</span>
                  </button>
                ))}
              </div>
            )}

            {agentResults.length > 0 && (
              <div className="gsearch__group">
                <span className="gsearch__group-title">Agents</span>
                {agentResults.map(({ agent, map, comp }) => (
                  <button
                    key={`${agent.uuid}-${map.uuid}-${comp.id}`}
                    className="gsearch__row"
                    onClick={() => go(`/editor/${map.uuid}?comp=${comp.id}`)}
                  >
                    <img src={agent.icon} alt="" className="gsearch__row-thumb gsearch__row-thumb--round" />
                    <span>
                      {agent.name} <span className="gsearch__muted">sur {map.name} · {comp.name}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
