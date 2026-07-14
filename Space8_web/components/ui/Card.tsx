import { tokens } from '@/app/styles/tokens'

type CardProps = {
  variant?: 'default' | 'elevated' | 'gradient' | 'glass'
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
  const isGlass = variant === 'glass'
  return (
    <div
      className={className}
      style={{
        backgroundColor: isGlass ? undefined : variant === 'elevated' ? tokens.colors.surfaceElevated : tokens.colors.surface,
        background: isGlass ? tokens.glassBg.dark : undefined,
        backdropFilter: isGlass ? tokens.glass.surface : undefined,
        WebkitBackdropFilter: isGlass ? tokens.glass.surface : undefined,
        backgroundImage:
          variant === 'gradient'
            ? 'linear-gradient(160deg, rgba(255,255,255,0.03) 0%, rgba(34,197,94,0.05) 100%)'
            : undefined,
        border: `1px solid ${isGlass ? tokens.glassBg.border : tokens.colors.border}`,
        borderRadius: tokens.radius.card,
        padding,
        ...style,
      }}
    >
      {children}
    </div>
  )
}
