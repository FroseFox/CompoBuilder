import discordMark from '../../assets/discord-mark.png'
import './PlayerAvatar.css'

/**
 * Petit avatar rond avec initiales, coloré selon le joueur. Fallback discret
 * si aucun joueur. `showDiscordBadge` ajoute un petit badge Discord en coin
 * quand la fiche est reliée à un compte (player.discordId) — utilisé
 * seulement là où on veut signaler "connecté via Discord" (profil, liste
 * des joueurs), pas sur tous les avatars du site (slots de composition,
 * grille de disponibilités...).
 */
export default function PlayerAvatar({ player, size = 'md', title, showDiscordBadge = false }) {
  if (!player) {
    return (
      <span className={`player-avatar player-avatar--empty player-avatar--${size}`} title={title || 'Aucun joueur assigné'}>
        ?
      </span>
    )
  }

  const initials = player.pseudo
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const avatar = (
    <span
      className={`player-avatar player-avatar--${size}`}
      style={{ '--avatar-color': player.color }}
      title={title || player.pseudo}
    >
      {initials}
    </span>
  )

  if (!showDiscordBadge || !player.discordId) {
    return avatar
  }

  return (
    <span className="player-avatar-wrap">
      {avatar}
      <span className={`player-avatar__discord-badge player-avatar__discord-badge--${size}`} title="Connecté via Discord">
        <img src={discordMark} alt="" />
      </span>
    </span>
  )
}
