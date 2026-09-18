import { useEffect, useState } from 'react'

/**
 * Identique à useLocalStorage (même fichier), mais avec sessionStorage :
 * la valeur ne survit que pour l'onglet en cours — elle traverse les
 * rechargements de page ET la navigation entre les pages du site (tant que
 * c'est le même onglet), mais repart à zéro dans un nouvel onglet ou une
 * nouvelle fenêtre. Utile pour tout ce qui doit se produire "une fois par
 * visite", contrairement à useLocalStorage qui serait "une fois pour de bon".
 */
export function useSessionStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const raw = sessionStorage.getItem(key)
      return raw !== null ? JSON.parse(raw) : initialValue
    } catch {
      return initialValue
    }
  })

  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(value))
    } catch {
      /* stockage indisponible : on continue en mémoire */
    }
  }, [key, value])

  return [value, setValue]
}
