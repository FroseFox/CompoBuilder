import { createContext, useContext, useEffect } from 'react'

const ThemeContext = createContext(null)

// Comme le site du réseau, le Comp Builder est toujours en sombre.
export function ThemeProvider({ children }) {
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'dark')
  }, [])
  return <ThemeContext.Provider value={{ theme: 'dark', toggleTheme: () => {} }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme doit être utilisé dans ThemeProvider')
  return ctx
}
