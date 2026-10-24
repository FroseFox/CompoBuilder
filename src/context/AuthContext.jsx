import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '../services/supabaseClient'
import { networkUrl, setTeamScope } from '../services/team'

const AuthContext = createContext(null)

/**
 * Connexion partagée avec le site du réseau (même base, même adresse) :
 * si tu es connecté sur le site, tu l'es ici aussi.
 *
 * - team : ton équipe sur le réseau (null si tu n'en as pas encore)
 * - isAdmin : peut modifier le Comp Builder de l'équipe
 *   (capitaine, ou membre que le capitaine a nommé « éditeur »)
 * - isCaptain : seul le capitaine nomme les éditeurs
 */
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [team, setTeam] = useState(null)
  const [profile, setProfile] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const userIdRef = useRef(null)
  const sessionRef = useRef(null)
  useEffect(() => {
    sessionRef.current = session
  }, [session])

  const loadContext = useCallback(async (sess) => {
    if (!sess?.user) {
      setTeam(null)
      setProfile(null)
      setIsAdmin(false)
      setTeamScope(null)
      return
    }
    const [{ data: ctx, error }, { data: editTeam }] = await Promise.all([
      supabase.rpc('my_context'),
      supabase.rpc('my_cb_edit_team'),
    ])
    if (error) {
      console.error(error)
      return
    }
    const t = ctx?.team || null
    setTeamScope(t?.id)
    setProfile(ctx?.profile || null)
    setTeam(t)
    setIsAdmin(Boolean(t && editTeam === t.id))
  }, [])

  useEffect(() => {
    let alive = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return
      setSession(data.session)
      userIdRef.current = data.session?.user?.id || null
      await loadContext(data.session)
      if (alive) setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      // Le premier état est déjà géré par getSession() ci-dessus
      if (event === 'INITIAL_SESSION') return
      setSession(newSession)
      const uid = newSession?.user?.id || null
      // Rechargement seulement si la personne change (pas à chaque
      // renouvellement de jeton, toutes les heures). Différé : appeler
      // Supabase directement dans ce callback peut bloquer la connexion.
      if (uid !== userIdRef.current) {
        userIdRef.current = uid
        setTimeout(() => loadContext(newSession), 0)
      }
    })
    return () => {
      alive = false
      sub.subscription.unsubscribe()
    }
  }, [loadContext])

  // Équipe en direct : quitter l'équipe, être nommé éditeur, changer de
  // logo… se répercute ici sans recharger (signal « team:<id> » du site).
  const teamId = team?.id
  useEffect(() => {
    if (!teamId) return undefined
    let timer
    const channel = supabase
      .channel(`cb-team-${teamId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_pulse', filter: `topic=eq.team:${teamId}` }, () => {
        clearTimeout(timer)
        timer = setTimeout(() => loadContext(sessionRef.current), 500)
      })
      .subscribe()
    return () => {
      clearTimeout(timer)
      supabase.removeChannel(channel)
    }
  }, [teamId, loadContext])

  // Connexion : on passe par le site du réseau (adresse déjà autorisée
  // chez Supabase), qui nous renvoie ici une fois connecté.
  const signInWithDiscord = async () => {
    try {
      sessionStorage.setItem('prizm_after_login', '#/compo')
    } catch {
      /* navigation privée stricte : on reviendra sur le site, pas grave */
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: { redirectTo: networkUrl() },
    })
    return error
  }

  const signOut = () => supabase.auth.signOut()

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user || null,
        profile,
        team,
        isAdmin,
        isCaptain: Boolean(team?.is_captain),
        loading,
        signInWithDiscord,
        signOut,
        refreshTeam: () => loadContext(session),
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth doit être utilisé dans AuthProvider')
  return ctx
}
