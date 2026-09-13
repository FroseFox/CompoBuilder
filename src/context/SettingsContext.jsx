import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { fetchTeamSettings, updateTeamSettingsRow } from '../services/db'
import { useAuth } from './AuthContext'
import { useToast } from './ToastContext'

const SettingsContext = createContext(null)

/**
 * Réglages partagés par toute l'équipe (pour l'instant : l'URL du
 * webhook Discord). Réservés aux admins côté RLS, donc on ne charge
 * même pas la requête pour un visiteur non connecté en admin.
 */
export function SettingsProvider({ children }) {
  const { isAdmin } = useAuth()
  const { pushToast } = useToast()
  const [webhookUrl, setWebhookUrl] = useState('')
  const [status, setStatus] = useState('idle')

  useEffect(() => {
    if (!isAdmin) {
      setStatus('idle')
      setWebhookUrl('')
      return
    }
    let cancelled = false
    setStatus('loading')
    fetchTeamSettings()
      .then((row) => {
        if (cancelled) return
        setWebhookUrl(row.discordWebhookUrl)
        setStatus('ready')
      })
      .catch((err) => {
        console.error(err)
        if (!cancelled) setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [isAdmin])

  const updateWebhookUrl = useCallback(
    async (url) => {
      try {
        const row = await updateTeamSettingsRow({ discordWebhookUrl: url })
        setWebhookUrl(row.discordWebhookUrl)
        return true
      } catch (err) {
        console.error(err)
        pushToast("Impossible d'enregistrer le webhook Discord.", 'error')
        return false
      }
    },
    [pushToast]
  )

  const value = useMemo(
    () => ({ webhookUrl, status, updateWebhookUrl }),
    [webhookUrl, status, updateWebhookUrl]
  )

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings doit être utilisé dans SettingsProvider')
  return ctx
}
