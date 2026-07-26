import './RoleBadge.css'

const ROLE_CLASS = {
  Duelist: 'role--duelist',
  Duelliste: 'role--duelist',
  Controller: 'role--controller',
  Contrôleur: 'role--controller',
  Initiator: 'role--initiator',
  Initiateur: 'role--initiator',
  Sentinel: 'role--sentinel',
  Sentinelle: 'role--sentinel',
}

export default function RoleBadge({ role, size = 'md' }) {
  if (!role) return null
  const roleClass = ROLE_CLASS[role.name] || 'role--default'

  return (
    <span className={`role-badge role-badge--${size} ${roleClass}`}>
      {role.icon && <img src={role.icon} alt="" aria-hidden="true" />}
      <span>{role.name}</span>
    </span>
  )
}
