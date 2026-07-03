'use client'

import { TrendingUp, TrendingDown, type LucideIcon } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { tokens } from '@/app/styles/tokens'

export default function StatCard({
  label,
  value,
  icon: Icon,
  trend,
}: {
  label: string
  value: string
  icon: LucideIcon
  trend?: number | null
}) {
  const trendColor = trend == null ? tokens.colors.textMuted : trend >= 0 ? tokens.colors.brand : tokens.colors.danger
  const TrendIcon = trend != null && trend < 0 ? TrendingDown : TrendingUp

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Icon size={18} color={tokens.colors.textMuted} />
        {trend != null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: trendColor, fontSize: 12, fontWeight: 600 }}>
            <TrendIcon size={13} />
            {trend >= 0 ? '+' : ''}
            {trend}%
          </div>
        )}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: tokens.colors.text, marginTop: 10 }}>{value}</div>
      <div style={{ fontSize: 13, color: tokens.colors.textMuted, marginTop: 4 }}>{label}</div>
    </Card>
  )
}
