import PlayerAvatar from '../PlayerAvatar/PlayerAvatar'
import './PlayerSelect.css'

export default function PlayerSelect({ players, value, onChange, label }) {
  const playerList = Object.values(players).sort((a, b) => a.pseudo.localeCompare(b.pseudo))
  const current = value ? players[value] : null

  return (
    <div className="player-select">
      <PlayerAvatar player={current} size="sm" />
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value || null)}
        aria-label={label || 'Assigner un joueur'}
      >
        <option value="">Aucun joueur</option>
        {playerList.map((p) => (
          <option key={p.id} value={p.id}>
            {p.pseudo}
          </option>
        ))}
      </select>
    </div>
  )
}
