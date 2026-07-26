import { useState } from 'react'
import { STATUS_META } from '../../utils/storage'
import './CompositionTabs.css'

export default function CompositionTabs({
  comps,
  activeCompId,
  editable = true,
  onSelect,
  onCreate,
  onRename,
  onSetMain,
  onDuplicate,
  onDelete,
}) {
  const [renamingId, setRenamingId] = useState(null)
  const [draftName, setDraftName] = useState('')

  const startRename = (comp) => {
    setRenamingId(comp.id)
    setDraftName(comp.name)
  }

  const commitRename = () => {
    const trimmed = draftName.trim()
    if (renamingId && trimmed) onRename(renamingId, trimmed)
    setRenamingId(null)
  }

  return (
    <div className="comp-tabs">
      <div className="comp-tabs__list">
        {comps.map((comp) => {
          const isActive = comp.id === activeCompId
          const isRenaming = renamingId === comp.id
          const meta = STATUS_META[comp.status]

          return (
            <div key={comp.id} className={`comp-tab ${isActive ? 'comp-tab--active' : ''}`}>
              {editable ? (
                <button
                  type="button"
                  className="comp-tab__star"
                  onClick={() => onSetMain(comp.id)}
                  aria-label={comp.isMain ? 'Composition principale' : 'Définir comme composition principale'}
                  title={comp.isMain ? 'Composition principale' : 'Définir comme principale'}
                >
                  {comp.isMain ? '⭐' : '☆'}
                </button>
              ) : (
                comp.isMain && <span className="comp-tab__star" aria-hidden="true">⭐</span>
              )}

              {isRenaming ? (
                <input
                  className="comp-tab__rename-input"
                  autoFocus
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename()
                    if (e.key === 'Escape') setRenamingId(null)
                  }}
                />
              ) : (
                <button type="button" className="comp-tab__label" onClick={() => onSelect(comp.id)}>
                  <span className="comp-tab__dot" style={{ '--status-color': meta.color }} />
                  {comp.name}
                </button>
              )}

              {isActive && !isRenaming && editable && (
                <span className="comp-tab__menu">
                  <button type="button" title="Renommer" onClick={() => startRename(comp)} aria-label="Renommer">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                      <path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                    </svg>
                  </button>
                  <button type="button" title="Dupliquer" onClick={() => onDuplicate(comp.id)} aria-label="Dupliquer">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                      <rect x="8" y="8" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.8" />
                      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" stroke="currentColor" strokeWidth="1.8" />
                    </svg>
                  </button>
                  {comps.length > 1 && (
                    <button type="button" title="Supprimer" onClick={() => onDelete(comp.id)} aria-label="Supprimer">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                        <path d="M5 7h14M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-9 0 1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  )}
                </span>
              )}
            </div>
          )
        })}
      </div>

      {editable && (
        <button type="button" className="comp-tabs__add" onClick={onCreate}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Nouvelle composition
        </button>
      )}
    </div>
  )
}
