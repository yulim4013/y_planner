import './ProgressBar.css'

interface ProgressBarProps {
  value: number
  max: number
  color?: string
}

export default function ProgressBar({ value, max, color }: ProgressBarProps) {
  const percent = max > 0 ? Math.round((value / max) * 100) : 0

  return (
    <div className="progress-bar-container">
      <div className="progress-bar-track">
        <div
          className="progress-bar-fill"
          style={{
            width: `${percent}%`,
            background: color || 'var(--color-primary)',
          }}
        />
      </div>
      <span className="progress-bar-label">{percent}%</span>
    </div>
  )
}
