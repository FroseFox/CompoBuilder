import { useEffect, useRef, useState } from 'react'
import { animate } from 'framer-motion'

// Sépare un préfixe/suffixe non numérique (ex. le "%" de "62%") de la
// valeur à animer, pour pouvoir compter uniquement la partie chiffrée.
const NUMBER_PATTERN = /^(\D*)(-?\d+(?:[.,]\d+)?)(\D*)$/

/**
 * Anime un nombre (ou une chaîne du type "62%") de sa valeur précédente
 * vers sa nouvelle valeur, façon compteur de tableau de bord. Retombe
 * silencieusement sur un simple rendu statique si la valeur n'a pas de
 * partie numérique reconnaissable.
 */
export default function CountUp({ value, duration = 0.7 }) {
  const match = typeof value === 'string' ? value.match(NUMBER_PATTERN) : null
  const numeric = match ? parseFloat(match[2].replace(',', '.')) : typeof value === 'number' ? value : null
  const prefix = match ? match[1] : ''
  const suffix = match ? match[3] : ''
  const decimals = match && match[2].includes('.') ? match[2].split('.')[1].length : 0

  const [display, setDisplay] = useState(numeric ?? 0)
  const prevRef = useRef(numeric ?? 0)

  useEffect(() => {
    if (numeric === null || Number.isNaN(numeric)) return undefined

    const controls = animate(prevRef.current, numeric, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setDisplay(v),
    })
    prevRef.current = numeric
    return () => controls.stop()
  }, [numeric, duration])

  if (numeric === null || Number.isNaN(numeric)) return <>{value}</>

  return (
    <>
      {prefix}
      {display.toFixed(decimals)}
      {suffix}
    </>
  )
}
