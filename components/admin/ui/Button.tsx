'use client'

type IconButtonProps = {
  label: string
  children: React.ReactNode
  className?: string
  onClick?: () => void
}

export function IconButton({ label, children, className = '', onClick }: IconButtonProps) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      className={`sg-icon-button ${className}`}
    >
      {children}
    </button>
  )
}

type PillButtonProps = {
  children: React.ReactNode
  primary?: boolean
  danger?: boolean
  className?: string
}

export function PillButton({ children, primary = false, danger = false, className = '' }: PillButtonProps) {
  return (
    <button
      className={`sg-pill-button ${primary ? 'is-primary' : ''} ${danger ? 'is-danger' : ''} ${className}`}
    >
      {children}
    </button>
  )
}
