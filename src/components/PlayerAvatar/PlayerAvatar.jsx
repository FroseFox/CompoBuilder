import './PlayerAvatar.css'

/** Petit avatar rond avec initiales, coloré selon le joueur. Fallback discret si aucun joueur. */
export default function PlayerAvatar({ player, size = 'md', title }) {
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

  return (
    <span
      className={`player-avatar player-avatar--${size}`}
      style={{ '--avatar-color': player.color }}
      title={title || player.pseudo}
    >
      {initials}
    </span>
  )
}
