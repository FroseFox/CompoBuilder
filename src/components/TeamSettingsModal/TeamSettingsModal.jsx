import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useSettings } from '../../context/SettingsContext'
import { useToast } from '../../context/ToastContext'
import { sendDiscordMessage, testMessageEmbed } from '../../utils/discordWebhook'
import './TeamSettingsModal.css'

export default function TeamSettingsModal({ open, onClose }) {
  const { webhookUrl, updateWebhookUrl } = useSettings()
  const { pushToast } = useToast()
  const [draft, setDraft] = useState(webhookUrl)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)

  // Repart de la valeur enregistrée à chaque ouverture (annule un
  // brouillon non sauvegardé de la fois précédente).
  useEffect(() => {
    if (open) setDraft(webhookUrl)
  }, [open, webhookUrl])

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
              Quand un webhook Discord est configuré, un message est posté automatiquement dans votre
              salon quand un match est ajouté ou qu'une composition passe au statut « Validée ».
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
