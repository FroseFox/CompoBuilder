import { HashRouter, Route, Routes } from 'react-router-dom'
import { ThemeProvider } from './context/ThemeContext'
import { AuthProvider } from './context/AuthContext'
import { DataProvider } from './context/DataContext'
import { CompositionsProvider } from './context/CompositionsContext'
import { PlayersProvider } from './context/PlayersContext'
import { ToastProvider } from './context/ToastContext'
import { useGameDataSync } from './hooks/useGameDataSync'
import { isSupabaseConfigured } from './services/supabaseClient'
import Navbar from './components/Navbar/Navbar'
import Home from './pages/Home/Home'
import Editor from './pages/Editor/Editor'
import Team from './pages/Team/Team'
import Dashboard from './pages/Dashboard/Dashboard'

/** Rendu à l'intérieur de tous les providers, pour pouvoir utiliser leurs hooks. */
function AppShell() {
  useGameDataSync()

  return (
    <HashRouter>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/editor/:mapId" element={<Editor />} />
        <Route path="/team" element={<Team />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
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
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <DataProvider>
            <PlayersProvider>
              <CompositionsProvider>
                <AppShell />
              </CompositionsProvider>
            </PlayersProvider>
          </DataProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  )
}
