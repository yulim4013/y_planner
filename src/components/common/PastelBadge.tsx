import './PastelBadge.css'

interface PastelBadgeProps {
  label: string
  color: string
  icon?: string
  small?: boolean
}

export default function PastelBadge({ label, color, icon, small }: PastelBadgeProps) {
  return (
    <span
      className={`pastel-badge ${small ? 'pastel-badge-sm' : ''}`}
      style={{ backgroundColor: color + '66', color: '#333' }}
    >
      {icon && <span className="pastel-badge-icon">{icon}</span>}
      {label}
    </span>
  )
}
