import type { CSSProperties, ReactNode } from 'react'
import './GlassCard.css'

interface GlassCardProps {
  children: ReactNode
  className?: string
  style?: CSSProperties
  onClick?: () => void
  strong?: boolean
}

export default function GlassCard({ children, className = '', style, onClick, strong }: GlassCardProps) {
  return (
    <div
      className={`glass-card ${strong ? 'glass-strong' : 'glass'} ${className}`}
      style={style}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {children}
    </div>
  )
}
