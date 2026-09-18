import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useSessionStorage } from '../../hooks/useSessionStorage'
import './IntroSplash.css'

// Durée pendant laquelle le logo reste affiché avant de s'effacer — doit
// rester synchronisée avec la durée de l'animation CSS de la barre de
// chargement (voir --intro-hold dans IntroSplash.css).
const HOLD_MS = 1400

// Mémorise que l'intro a déjà été vue pour cet onglet : sessionStorage (pas
// localStorage) est fait exactement pour ça, "une fois par visite" plutôt
// que "une fois pour de bon". Ça couvre les deux à la fois : naviguer entre
// les pages du site (Match Center, Éditeur...) puis revenir à l'accueil ne
// la rejoue pas (même onglet, sessionStorage déjà posé) ; ouvrir un nouvel
// onglet — ou revenir plus tard — la rejoue (sessionStorage reparti à zéro).
const SEEN_KEY = 'compo-builder-intro-seen'

/**
 * Écran d'ouverture façon "splash screen de jeu" (dans l'esprit du logo
 * Mojang au lancement de Minecraft, mais avec l'identité de Comp Builder —
 * on ne peut pas reprendre une marque qui n'est pas la nôtre) : logo qui
 * apparaît en fondu/zoom sur fond sombre, tenu un court instant, puis
 * s'efface pour révéler la page. Rejoué une fois par onglet/visite — pas à
 * chaque passage sur l'accueil pendant qu'on navigue dans le site, mais de
 * nouveau dans un nouvel onglet — voir SEEN_KEY ci-dessus. Voir son unique
 * usage dans Home.jsx.
 *
 * Rendu via un portail dans document.body : passe par-dessus la navbar et
 * tout le reste de la mise en page, sans dépendre de l'endroit où le
 * composant est monté dans l'arbre.
 *
 * L'overlay est purement cosmétique — aria-hidden, jamais un obstacle pour
 * un lecteur d'écran : le contenu réel de la page est déjà présent dans le
 * DOM en dessous pendant ce temps, pas retardé par cet écran.
 */
export default function IntroSplash() {
  const [seen, setSeen] = useSessionStorage(SEEN_KEY, false)
  // Lu une seule fois à l'instanciation (useState paresseux) : si `seen`
  // change en cours de route (ex. plusieurs onglets ouverts), ça ne doit pas
  // faire réapparaître ou disparaître l'écran déjà en cours d'affichage.
  const [visible, setVisible] = useState(() => !seen)

  useEffect(() => {
    // Déjà vue : rien à jouer, et surtout ne pas toucher au défilement de la
    // page (voir plus bas) puisqu'il n'y a rien à révéler après coup.
    if (seen) return undefined

    // Empêche le défilement pendant l'intro (l'utilisateur ne devrait pas
    // pouvoir "scroller sous" un écran plein cadre censé être immobile).
    // Restauré dès la fin du délai, PAS seulement au démontage : ce
    // composant reste monté (juste invisible) tant que la page d'accueil
    // l'est, donc ne restaurer qu'au démontage bloquait le défilement en
    // permanence après l'intro — plus moyen de naviguer sur la page.
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const timer = setTimeout(() => {
      setVisible(false)
      setSeen(true)
      document.body.style.overflow = previousOverflow
    }, HOLD_MS)
    return () => {
      clearTimeout(timer)
      document.body.style.overflow = previousOverflow
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seen/setSeen lus une seule fois par design (voir commentaires ci-dessus)
  }, [])

  return createPortal(
    <AnimatePresence>
      {visible && (
        <motion.div
          className="intro-splash"
          aria-hidden="true"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.35, ease: 'easeIn' } }}
        >
          <div className="intro-splash__glow" />

          <motion.div
            className="intro-splash__mark"
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1, transition: { duration: 0.5, ease: [0.34, 1.56, 0.64, 1] } }}
          >
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M12 3v6M12 15v6M3 12h6M15 12h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" />
              <rect x="10.6" y="10.6" width="2.8" height="2.8" fill="currentColor" />
            </svg>
          </motion.div>

          <motion.p
            className="intro-splash__title"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0, transition: { delay: 0.22, duration: 0.4, ease: 'easeOut' } }}
          >
            COMP<span className="intro-splash__title-accent">BUILDER</span>
          </motion.p>

          <motion.div
            className="intro-splash__bar-track"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { delay: 0.4, duration: 0.3 } }}
          >
            <div className="intro-splash__bar-fill" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
