import { useEffect, useState } from 'react'

/**
 * Hook générique qui synchronise un state React avec le localStorage.
 */
export function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw !== null ? JSON.parse(raw) : initialValue
    } catch {
      return initialValue
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      /* stockage indisponible : on continue en mémoire */
    }
  }, [key, value])

  return [value, setValue]
}
