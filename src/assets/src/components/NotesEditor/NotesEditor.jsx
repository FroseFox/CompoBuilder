import { useEffect, useRef, useState } from 'react'
import './NotesEditor.css'

export default function NotesEditor({ value, onSave }) {
  const [draft, setDraft] = useState(value)
  const [saved, setSaved] = useState(true)
  const timeoutRef = useRef(null)

  // Si on change de composition, on resynchronise le brouillon local.
  useEffect(() => {
    setDraft(value)
    setSaved(true)
  }, [value])

  const handleChange = (e) => {
    const next = e.target.value
    setDraft(next)
    setSaved(false)
    clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      onSave(next)
      setSaved(true)
    }, 600)
  }

  useEffect(() => () => clearTimeout(timeoutRef.current), [])

  return (
    <div className="notes-editor">
      <textarea
        value={draft}
        onChange={handleChange}
        placeholder="Stratégie générale, calls importants, timings, erreurs à éviter, objectifs…"
        rows={7}
      />
      <span className={`notes-editor__status ${saved ? 'notes-editor__status--saved' : ''}`}>
        {saved ? 'Sauvegardé' : 'Sauvegarde…'}
      </span>
    </div>
  )
}
