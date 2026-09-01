'use client'

/**
 * RevenueWidget — displays today's or monthly revenue.
 *
 * §3.1 / §3.2: Green numeral, trend arrow (▲▼), handles both variants
 * via the `size` prop. Self-fetches stats from /api/admin/stats.
 */

import { useEffect, useState } from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import WidgetCard from './WidgetCard'
import type { WidgetProps } from '@/lib/admin/widgetRegistry'
import type { AdminStats } from '@/lib/data/getAdminStats'

export default function RevenueWidget({ size }: WidgetProps) {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function fetchStats() {
      try {
        const res = await fetch('/api/admin/stats')
        if (!res.ok) throw new Error('Failed to fetch stats')
        const json = await res.json()
        if (!cancelled && json?.stats) {
          setStats(json.stats as AdminStats)
        }
      } catch {
        // API may not exist yet — stays null
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchStats()
    return () => { cancelled = true }
  }, [])

  const isToday = size === 'sm'
  const amount = stats ? (isToday ? stats.revenue.today : stats.revenue.month) : 0
  const trend = stats ? (isToday ? stats.revenueTrend.today : stats.revenueTrend.month) : null
  const bookingsCount = stats ? (isToday ? stats.bookingsCount.today : stats.bookingsCount.month) : 0
  const label = isToday ? "Today's Revenue" : 'Monthly Revenue'

  const trendColor =
    trend === null
      ? 'text-[var(--admin-text-muted)]'
      : trend > 0
        ? 'text-[var(--admin-brand)]'
        : trend < 0
          ? 'text-red-400'
          : 'text-[var(--admin-text-muted)]'

  const TrendIcon =
    trend === null ? Minus : trend > 0 ? TrendingUp : TrendingDown

  return (
    <WidgetCard
      title={label}
      cmsKey={isToday ? 'widget_revenue_today' : 'widget_revenue_month'}
      size={size}
      status={loading ? 'stale' : 'live'}
    >
      <div className="flex items-end justify-between">
        {/* Main number */}
        <div>
          <span className="text-3xl font-bold text-[var(--admin-brand)] tabular-nums">
            {loading ? '—' : `$${amount.toLocaleString('en-HK')}`}
          </span>
          {!loading && (
            <span className="text-xs text-[var(--admin-text-muted)] ml-1">HKD</span>
          )}
        </div>

        {/* Trend badge */}
        {!loading && trend !== null && (
          <div className={`flex items-center gap-1 text-xs font-medium ${trendColor}`}>
            <TrendIcon size={14} strokeWidth={1.5} />
            <span>{Math.abs(trend)}%</span>
          </div>
        )}
      </div>

      {/* Subtle secondary metric */}
      <div className="mt-2 text-xs text-[var(--admin-text-muted)]">
        {loading
          ? 'Loading…'
          : isToday
            ? `${bookingsCount} booking${bookingsCount !== 1 ? 's' : ''}`
            : `${bookingsCount} booking${bookingsCount !== 1 ? 's' : ''} this month`}
      </div>
    </WidgetCard>
  )
}
