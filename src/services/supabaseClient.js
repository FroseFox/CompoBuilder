import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  // Message volontairement explicite : c'est l'erreur n°1 des débutants
  // (fichier .env manquant ou mal nommé). Voir le README, section Supabase.
  console.error(
    "Configuration Supabase manquante. Vérifiez que le fichier .env contient " +
      'VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY, puis relancez `npm run dev`.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

/** true si les variables d'environnement Supabase sont présentes. */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)
