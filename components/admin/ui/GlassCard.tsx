'use client'

type GlassCardProps = {
  children: React.ReactNode
  className?: string
}

export default function GlassCard({ children, className = '' }: GlassCardProps) {
  return (
    <section className={`sg-glass-card ${className}`}>
      <div className="sg-glass-orb" />
      {children}
    </section>
  )
}
