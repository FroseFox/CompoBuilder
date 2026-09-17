import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../services/supabaseClient'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  // Récupère la session existante au chargement, puis écoute les
  // changements (connexion, déconnexion, expiration de session).
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => subscription.subscription.unsubscribe()
  }, [])

  // Un utilisateur connecté n'est "admin" que si sa ligne dans la table
  // `profiles` a is_admin = true (voir le README pour l'activer en base).
  useEffect(() => {
    let cancelled = false

    async function checkAdmin() {
      if (!session?.user) {
        setIsAdmin(false)
        return
      }
      const { data, error } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', session.user.id)
        .single()
      if (!cancelled) setIsAdmin(!error && Boolean(data?.is_admin))
    }

    checkAdmin()
    return () => {
      cancelled = true
    }
  }, [session])

  // Seule méthode de connexion du site : se connecter avec Discord crée
  // (ou relie) automatiquement la fiche joueur côté base — voir le
  // trigger handle_new_user() dans supabase/schema.sql. is_admin reste
  // toujours réglé à la main dans Supabase (table profiles), inchangé.
  // redirectTo pointe vers la racine du site (sans route HashRouter) :
  // Supabase y ajoute son ?code=... (flux PKCE, voir supabaseClient.js),
  // et onAuthStateChange ci-dessus prend le relais une fois la session
  // posée, quelle que soit la route sur laquelle l'utilisateur atterrit.
  const signInWithDiscord = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: { redirectTo: window.location.origin + window.location.pathname },
    })
    return error
  }

  const signOut = () => supabase.auth.signOut()

  return (
    <AuthContext.Provider
      value={{ session, user: session?.user || null, isAdmin, loading, signInWithDiscord, signOut }}
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
