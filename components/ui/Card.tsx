import { tokens } from '@/app/styles/tokens'

type CardProps = {
  variant?: 'default' | 'elevated' | 'gradient'
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
        backgroundImage:
          variant === 'gradient'
            ? 'linear-gradient(160deg, rgba(255,255,255,0.03) 0%, rgba(34,197,94,0.05) 100%)'
            : undefined,
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
