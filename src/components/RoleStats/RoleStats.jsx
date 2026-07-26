import './RoleStats.css'

const ROLE_ORDER = ['Duelliste', 'Duelist', 'Contrôleur', 'Controller', 'Initiateur', 'Initiator', 'Sentinelle', 'Sentinel']

export default function RoleStats({ agentsInComp }) {
  const counts = new Map()
  agentsInComp.forEach((agent) => {
    const key = agent.role.name
    counts.set(key, (counts.get(key) || 0) + 1)
  })

  const entries = [...counts.entries()].sort(
    (a, b) => ROLE_ORDER.indexOf(a[0]) - ROLE_ORDER.indexOf(b[0])
  )

  if (entries.length === 0) {
    return (
      <div className="role-stats role-stats--empty">
        <p>Aucun agent sélectionné pour le moment — la répartition des rôles s'affichera ici.</p>
      </div>
    )
  }

  return (
    <div className="role-stats">
      {entries.map(([roleName, count]) => (
        <div key={roleName} className={`role-stat role-stat--${slug(roleName)}`}>
          <span className="role-stat__count">{count}</span>
          <span className="role-stat__label">{roleName}</span>
        </div>
      ))}
    </div>
  )
}

function slug(name) {
  const map = {
    Duelliste: 'duelist',
    Duelist: 'duelist',
    Contrôleur: 'controller',
    Controller: 'controller',
    Initiateur: 'initiator',
    Initiator: 'initiator',
    Sentinelle: 'sentinel',
    Sentinel: 'sentinel',
  }
  return map[name] || 'default'
}
