import './Header.css'

interface HeaderProps {
  title: string
  right?: React.ReactNode
}

export default function Header({ title, right }: HeaderProps) {
  return (
    <header className="app-header">
      <h1 className="header-title" translate="no">{title}</h1>
      {right && <div className="header-right">{right}</div>}
    </header>
  )
}
