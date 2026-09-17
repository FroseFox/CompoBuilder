import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

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

// PWA (installable sur mobile/desktop) : manifeste + service worker qui met
// en cache l'app pour un chargement quasi instantané et un fonctionnement
// hors-ligne partiel (l'historique/les compos déjà chargés restent
// consultables sans réseau — écrire nécessite toujours Supabase).
// registerType 'autoUpdate' : la nouvelle version prend le relais toute
// seule au rechargement suivant, sans bandeau "mettre à jour" à gérer.
function pwaPlugin() {
  return VitePWA({
    registerType: 'autoUpdate',
    injectRegister: 'auto',
    includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
    manifest: {
      name: 'Comp Builder — Compositions Valorant',
      short_name: 'Comp Builder',
      description: 'Créez et sauvegardez vos compositions de 5 agents Valorant, pour chaque map, et gérez votre équipe.',
      // Chemins relatifs : cohérent avec base: './' plus bas, fonctionne
      // aussi bien en project pages (/CompoBuilder/) qu'en domaine racine.
      start_url: './',
      scope: './',
      display: 'standalone',
      background_color: '#0a0e14',
      theme_color: '#0f1923',
      lang: 'fr',
      icons: [
        { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
        { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
        { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    workbox: {
      // Les appels Supabase (API + websocket temps réel) ne doivent jamais
      // être servis depuis le cache : seuls les fichiers de l'app (JS/CSS/
      // polices/images locales) sont précachés par défaut par le plugin.
      navigateFallbackDenylist: [/^\/rest\//, /^\/auth\//],
    },
  })
}

// base: './' => chemins relatifs, fonctionne tel quel sur GitHub Pages
// (project pages ou user pages, sans configuration supplémentaire)
export default defineConfig({
  plugins: [react(), cspPlugin(), pwaPlugin()],
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
