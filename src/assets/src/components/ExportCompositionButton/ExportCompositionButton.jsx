import { useState } from 'react'
import { renderCompositionCard, compositionFileName } from '../../utils/exportComposition'
import { useToast } from '../../context/ToastContext'
import './ExportCompositionButton.css'

const canCopyImages = typeof window !== 'undefined' && Boolean(window.ClipboardItem) && navigator.clipboard?.write

export default function ExportCompositionButton({ map, composition, agentByUuid, players }) {
  const { pushToast } = useToast()
  const [busy, setBusy] = useState(null) // 'download' | 'copy' | null

  const filledCount = composition.slots.filter((s) => s.agentUuid).length

  const generate = () => renderCompositionCard({ map, composition, agentByUuid, players })

  const handleDownload = async () => {
    setBusy('download')
    try {
      const blob = await generate()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = compositionFileName(map, composition)
      a.click()
      URL.revokeObjectURL(url)
      pushToast('Image téléchargée.', 'success')
    } catch {
      pushToast("Impossible de générer l'image.", 'error')
    } finally {
      setBusy(null)
    }
  }

  const handleCopy = async () => {
    setBusy('copy')
    try {
      const blob = await generate()
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      pushToast('Image copiée — collez-la dans Discord.', 'success')
    } catch {
      pushToast("Impossible de copier l'image.", 'error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="export-comp">
      <button
        type="button"
        className="btn btn-ghost export-comp__btn"
        onClick={handleDownload}
        disabled={busy !== null || filledCount === 0}
        title={filledCount === 0 ? 'Ajoutez au moins un agent pour exporter' : "Télécharger l'image de cette composition"}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
          <path d="M12 3v13m0 0-4.5-4.5M12 16l4.5-4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M4 19h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        {busy === 'download' ? 'Génération…' : 'Exporter'}
      </button>

      {canCopyImages && (
        <button
          type="button"
          className="btn btn-ghost export-comp__btn export-comp__btn--icon"
          onClick={handleCopy}
          disabled={busy !== null || filledCount === 0}
          title="Copier l'image (pour la coller directement dans Discord)"
          aria-label="Copier l'image de cette composition"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <rect x="9" y="9" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="2" />
            <path d="M5 15V5a2 2 0 0 1 2-2h10" stroke="currentColor" strokeWidth="2" />
          </svg>
        </button>
      )}
    </div>
  )
}
