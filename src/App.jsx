import { Suspense, lazy } from 'react'
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AnimatePresence, MotionConfig } from 'framer-motion'
import { ThemeProvider } from './context/ThemeContext'
import { SoundProvider } from './context/SoundContext'
import { AuthProvider } from './context/AuthContext'
import { SettingsProvider } from './context/SettingsContext'
import { DataProvider } from './context/DataContext'
import { CompositionsProvider } from './context/CompositionsContext'
import { PlayersProvider } from './context/PlayersContext'
import { MatchesProvider } from './context/MatchesContext'
import { ToastProvider } from './context/ToastContext'
import { useGameDataSync } from './hooks/useGameDataSync'
import { isSupabaseConfigured } from './services/supabaseClient'
import Navbar from './components/Navbar/Navbar'
import PageTransition from './components/PageTransition/PageTransition'
import Loader from './components/Loader/Loader'
import ErrorBoundary from './components/ErrorBoundary/ErrorBoundary'

// Chaque page dans son propre chunk : le premier chargement ne télécharge
// que la page demandée, pas les 6 à la fois (le bundle faisait ~590 Ko
// d'un seul bloc auparavant).
const Home = lazy(() => import('./pages/Home/Home'))
const Editor = lazy(() => import('./pages/Editor/Editor'))
const Team = lazy(() => import('./pages/Team/Team'))
const Dashboard = lazy(() => import('./pages/Dashboard/Dashboard'))
const MatchCenter = lazy(() => import('./pages/MatchCenter/MatchCenter'))
const Stats = lazy(() => import('./pages/Stats/Stats'))

/** Rendu à l'intérieur du HashRouter : gère la transition animée entre les pages. */
function AppRoutes() {
  const location = useLocation()

  return (
    <Suspense fallback={<div className="container"><Loader label="Chargement…" /></div>}>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<PageTransition><Home /></PageTransition>} />
          <Route path="/editor/:mapId" element={<PageTransition><Editor /></PageTransition>} />
          <Route path="/team" element={<PageTransition><Team /></PageTransition>} />
          <Route path="/dashboard" element={<PageTransition><Dashboard /></PageTransition>} />
          <Route path="/matchcenter" element={<PageTransition><MatchCenter /></PageTransition>} />
          <Route path="/stats" element={<PageTransition><Stats /></PageTransition>} />
          {/* Toute URL inconnue renvoie vers l'accueil plutôt que sur une page blanche. */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AnimatePresence>
    </Suspense>
  )
}

/** Rendu à l'intérieur de tous les providers, pour pouvoir utiliser leurs hooks. */
function AppShell() {
  useGameDataSync()

  return (
    <HashRouter>
      {/* reducedMotion="user" : respecte automatiquement le réglage système
          "Réduire les animations" pour TOUTES les animations Framer Motion
          de l'app (transitions de page, sidebar, recherche...). La media
          query CSS prefers-reduced-motion ne couvre pas ces animations
          pilotées en JS, d'où ce réglage complémentaire. */}
      <MotionConfig reducedMotion="user">
        <div className="app-layout">
          <Navbar />
          <div className="app-layout__main">
            <AppRoutes />
          </div>
        </div>
      </MotionConfig>
    </HashRouter>
  )
}

/** Écran affiché si le fichier .env est manquant ou incomplet — voir README. */
function SupabaseSetupNotice() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#0b1119', color: '#ece8e1', fontFamily: 'system-ui, sans-serif', padding: 24,
    }}>
      <div style={{ maxWidth: 480, textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.3rem', marginBottom: 12 }}>Configuration Supabase manquante</h1>
        <p style={{ color: '#97a3ad', lineHeight: 1.6 }}>
          Le fichier <code>.env</code> n'existe pas encore, ou il lui manque
          <code> VITE_SUPABASE_URL</code> / <code>VITE_SUPABASE_ANON_KEY</code>.
          Copiez <code>.env.example</code> en <code>.env</code>, remplissez les deux valeurs
          depuis votre projet Supabase, puis relancez <code>npm run dev</code>.
          Voir le README, section « Connecter Supabase ».
        </p>
      </div>
    </div>
  )
}

export default function App() {
  if (!isSupabaseConfigured) {
    return <SupabaseSetupNotice />
  }

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <SoundProvider>
          <ToastProvider>
            <AuthProvider>
              <SettingsProvider>
                <DataProvider>
                  <PlayersProvider>
                    <CompositionsProvider>
                      <MatchesProvider>
                        <AppShell />
                      </MatchesProvider>
                    </CompositionsProvider>
                  </PlayersProvider>
                </DataProvider>
              </SettingsProvider>
            </AuthProvider>
          </ToastProvider>
        </SoundProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}
