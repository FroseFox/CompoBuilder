import { createClient } from '@supabase/supabase-js'

// Même base que le site du PRIZM Competitive Network : la connexion
// Discord est partagée (on se connecte une fois, sur le site ou ici).
// Ces deux valeurs sont publiques par nature (elles finissent dans le
// JavaScript envoyé au navigateur) ; la sécurité repose sur les règles
// RLS de la base. Le .env reste prioritaire pour un test en local.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://cbbnrdfvaaikawszaysu.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_rfB8KSptjcdTpp8QxvST9A_UlpQ8rW0'

// flowType 'pkce' : la connexion Discord renvoie un ?code=… dans l'URL
// plutôt qu'un #access_token=…, qui entrerait en collision avec le
// routage par # (HashRouter ici, routes #/… sur le site du réseau).
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { flowType: 'pkce', persistSession: true, detectSessionInUrl: true },
  // Peu de messages temps réel par seconde suffisent largement ici
  realtime: { params: { eventsPerSecond: 5 } },
})

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)
