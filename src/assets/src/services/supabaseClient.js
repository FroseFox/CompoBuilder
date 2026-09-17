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

// flowType: 'pkce' — la connexion Discord (OAuth) renvoie normalement le
// jeton dans le FRAGMENT d'URL (#access_token=...), qui rentrerait en
// collision avec le routing du site (HashRouter, lui-même basé sur le
// fragment : #/team, #/dispos...). Le flux PKCE renvoie plutôt un code
// dans la QUERY STRING (?code=...), qui ne touche pas au fragment : les
// deux mécanismes cohabitent sans se marcher dessus.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { flowType: 'pkce' },
})

/** true si les variables d'environnement Supabase sont présentes. */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)
