import { useEffect, useState } from 'react'

/**
 * true tant que la media query correspond, mis à jour en direct au
 * redimensionnement (contrairement à un simple test au montage — utile
 * pour adapter un comportement JS, pas seulement du style, au même
 * point de rupture qu'une media query CSS existante).
 */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => (typeof window !== 'undefined' ? window.matchMedia(query).matches : false))

  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = () => setMatches(mql.matches)
    onChange()
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])

  return matches
}
