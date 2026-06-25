import { tokens } from '@/app/styles/tokens'

type CardProps = {
  variant?: 'default' | 'elevated'
  padding?: string
  children: React.ReactNode
  style?: React.CSSProperties
  className?: string
}

export function Card({
  variant = 'default',
  padding = tokens.spacing.lg,
  children,
  style,
  className,
}: CardProps) {
  return (
    <div
      className={className}
      style={{
        backgroundColor: variant === 'elevated' ? tokens.colors.surfaceElevated : tokens.colors.surface,
        border: `1px solid ${tokens.colors.border}`,
        borderRadius: tokens.radius.card,
        padding,
        ...style,
      }}
    >
      {children}
    </div>
  )
}
