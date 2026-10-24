import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useSettings } from '../../context/SettingsContext'
import { useToast } from '../../context/ToastContext'
import { sendDiscordMessage, testMessageEmbed } from '../../utils/discordWebhook'
import { useEscapeToClose } from '../../hooks/useEscapeToClose'
import { importLegacyData } from '../../services/importLegacy'
import { useCompositions } from '../../context/CompositionsContext'
import './TeamSettingsModal.css'

export default function TeamSettingsModal({ open, onClose }) {
  const { webhookUrl, updateWebhookUrl } = useSettings()
  const { pushToast } = useToast()
  const [draft, setDraft] = useState(webhookUrl)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [legacyKey, setLegacyKey] = useState('')
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState('')
  const { compositionsByMap } = useCompositions()
  const existingComps = Object.values(compositionsByMap).reduce((n, b) => n + Object.keys(b || {}).length, 0)

  const handleImport = async () => {
    if (importing) return
    if (existingComps > 0 && !window.confirm(`Ton Comp Builder contient déjà ${existingComps} composition(s). L'import va ajouter les anciennes en plus. Continuer ?`)) return
    setImporting(true)
    setImportMsg('')
    try {
      const r = await importLegacyData({ key: legacyKey, onProgress: setImportMsg })
      setImportMsg(`Terminé : ${r.compositions} compositions, ${r.matches} matchs, ${r.players} joueurs et ${r.availability} créneaux repris.`)
      setLegacyKey('')
      pushToast('Anciennes données importées.', 'success')
    } catch (err) {
      console.error(err)
      setImportMsg(err.message || 'Import impossible.')
    } finally {
      setImporting(false)
    }
  }

  // Repart de la valeur enregistrée à chaque ouverture (annule un
  // brouillon non sauvegardé de la fois précédente).
  useEffect(() => {
    if (open) setDraft(webhookUrl)
  }, [open, webhookUrl])

  useEscapeToClose(open, onClose)

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    const ok = await updateWebhookUrl(draft.trim())
    setSaving(false)
    if (ok) {
      pushToast('Réglages enregistrés.', 'success')
      onClose()
    }
  }

  const handleTest = async () => {
    const url = draft.trim()
    if (!url) return
    setTesting(true)
    const ok = await sendDiscordMessage(testMessageEmbed(), { testUrl: url })
    setTesting(false)
    pushToast(
      ok ? 'Message de test envoyé — regardez votre salon Discord.' : "Échec de l'envoi. Vérifiez l'URL du webhook.",
      ok ? 'success' : 'error'
    )
  }

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
          <motion.form
            className="team-settings glass-panel"
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 420, damping: 32 } }}
            exit={{ opacity: 0, y: 10, scale: 0.98, transition: { duration: 0.15 } }}
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSave}
          >
            <h3>Réglages d'équipe</h3>
            <p className="team-settings__hint">
              Avec un webhook Discord, un message est posté dans le salon de ton équipe quand un match est
              ajouté ou qu'une compo est validée, plus un rappel une heure avant chaque match. Pour les votes
              ✅/❌, le bot PRIZM doit être présent sur ton serveur.
            </p>

            <label className="player-form__field">
              <span>URL du webhook Discord</span>
              <input
                type="url"
                placeholder="https://discord.com/api/webhooks/…"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
            </label>

            <p className="team-settings__help">
              Dans Discord : Paramètres du serveur → Intégrations → Webhooks → Nouveau webhook, puis
              copiez son URL ici.
            </p>

            <details className="team-settings__import">
              <summary>Reprendre les données de l'ancien Comp Builder</summary>
              <p className="team-settings__help">
                À faire une seule fois. Dans ton ancien projet Supabase : Project Settings → API Keys, copie la clé
                « anon public » et colle-la ici. Compos, matchs, joueurs et dispos sont copiés dans le Comp Builder
                de ton équipe ; l'ancien projet n'est pas modifié.
              </p>
              <label className="player-form__field">
                <span>Clé anon de l'ancien projet</span>
                <input
                  type="password"
                  autoComplete="off"
                  placeholder="eyJhbGciOi…"
                  value={legacyKey}
                  onChange={(e) => setLegacyKey(e.target.value)}
                />
              </label>
              <button type="button" className="btn btn-ghost" onClick={handleImport} disabled={!legacyKey.trim() || importing}>
                {importing ? 'Import en cours…' : 'Importer'}
              </button>
              {importMsg && <p className="team-settings__help" role="status">{importMsg}</p>}
            </details>

            <div className="confirm-dialog__actions team-settings__actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={handleTest}
                disabled={!draft.trim() || testing || saving}
              >
                {testing ? 'Envoi…' : 'Tester'}
              </button>
              <div className="team-settings__actions-right">
                <button type="button" className="btn btn-ghost" onClick={onClose}>
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Enregistrement…' : 'Enregistrer'}
                </button>
              </div>
            </div>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
