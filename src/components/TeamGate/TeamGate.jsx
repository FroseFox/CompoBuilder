import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { networkUrl } from '../../services/team'
import Loader from '../Loader/Loader'
import discordMark from '../../assets/discord-mark.png'
import './TeamGate.css'

/**
 * Porte d'entrée du Comp Builder : il faut être connecté (Discord) et
 * faire partie d'une équipe du PRIZM Competitive Network. Chaque équipe
 * a son propre Comp Builder, invisible pour les autres.
 */
export default function TeamGate({ children }) {
  const { loading, user, team, signInWithDiscord } = useAuth()
  const [busy, setBusy] = useState(false)

  if (loading) {
    return (
      <div className="team-gate">
        <Loader label="Chargement…" />
      </div>
    )
  }

  if (!user) {
    const login = async () => {
      setBusy(true)
      const error = await signInWithDiscord()
      if (error) setBusy(false)
    }
    return (
      <div className="team-gate">
        <div className="team-gate__card glass-panel cut-corner">
          <span className="eyebrow">PRIZM Competitive Network</span>
          <h1 className="team-gate__title">Comp Builder</h1>
          <p className="team-gate__lead">
            Les compos de ton équipe, map par map : agents, joueurs, statut et notes de stratégie.
            Chaque équipe du réseau a son propre espace, visible seulement par ses joueurs.
          </p>
          <button type="button" className="btn btn-primary team-gate__cta" onClick={login} disabled={busy}>
            <img src={discordMark} alt="" />
            {busy ? 'Redirection…' : 'Se connecter avec Discord'}
          </button>
          <a className="team-gate__back" href={networkUrl('#/reseau')}>
            ← Retour au site du réseau
          </a>
        </div>
      </div>
    )
  }

  if (!team) {
    return (
      <div className="team-gate">
        <div className="team-gate__card glass-panel cut-corner">
          <span className="eyebrow">Comp Builder</span>
          <h1 className="team-gate__title">Il te faut une équipe</h1>
          <p className="team-gate__lead">
            Le Comp Builder est relié à ton équipe du réseau. Crée ton équipe ou rejoins-la avec le code
            de ton capitaine : tes coéquipiers et toi retrouverez ici vos compos.
          </p>
          <a className="btn btn-primary team-gate__cta" href={networkUrl('#/mon-equipe')}>
            Créer ou rejoindre une équipe
          </a>
          <a className="team-gate__back" href={networkUrl('#/reseau')}>
            ← Retour au site du réseau
          </a>
        </div>
      </div>
    )
  }

  return children
}
