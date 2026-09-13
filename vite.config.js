import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Content-Security-Policy injecté uniquement dans le build de production.
// Jamais en dev : le script inline injecté par React Fast Refresh (HMR)
// serait bloqué par un script-src strict, ce qui casserait `npm run dev`.
// Limite en pratique : GitHub Pages ne permet pas d'envoyer de vrais en-têtes
// HTTP, donc ceci passe par une balise <meta> — ce qui fonctionne pour
// script-src/style-src/connect-src/img-src, mais PAS pour frame-ancestors
// (ignoré par les navigateurs dans une balise meta, uniquement valable en
// en-tête HTTP réel). Pour une protection anti-clickjacking complète, il
// faudrait héberger derrière un service qui permet de définir des en-têtes
// (Cloudflare Pages, Netlify, Vercel...).
function cspPlugin() {
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https://*.valorant-api.com https://*.supabase.co",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://valorant-api.com https://*.valorant-api.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')

  return {
    name: 'inject-csp-meta',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        '<meta charset="UTF-8" />',
        `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${csp}" />`
      )
    },
  }
}

// base: './' => chemins relatifs, fonctionne tel quel sur GitHub Pages
// (project pages ou user pages, sans configuration supplémentaire)
export default defineConfig({
  plugins: [react(), cspPlugin()],
  base: './',
  build: {
    rollupOptions: {
      output: {
        // Sépare les grosses dépendances du code applicatif : ces libs ne
        // changent quasiment jamais, donc le navigateur les garde en cache
        // même quand une mise à jour ne touche que le code de l'app.
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-motion': ['framer-motion'],
          'vendor-supabase': ['@supabase/supabase-js'],
        },
      },
    },
  },
})
