'use client'

/**
 * ActiveUsersWidget — live active user count.
 *
 * §3.7: users WHERE last_active_at > now()-15min.
 * Shows count with a subtle breathing glow when > 0.
 */

import { useEffect, useState } from 'react'
import { Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import WidgetCard from './WidgetCard'
import type { WidgetProps } from '@/lib/admin/widgetRegistry'

export default function ActiveUsersWidget({ size }: WidgetProps) {
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()

    async function fetchActive() {
      try {
        const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString()
        const { count: c } = await supabase
          .from('users')
          .select('id', { count: 'exact', head: true })
          .gte('last_active_at', fifteenMinAgo)

        if (!cancelled) setCount(c ?? 0)
      } catch {
        // Column may not exist — stays zero
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchActive()
    // Poll every 60s
    const interval = setInterval(fetchActive, 60_000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  return (
    <WidgetCard
      title="Active Users"
      cmsKey="widget_active_users"
      size={size}
      status={loading ? 'stale' : 'live'}
    >
      <div className="flex items-center gap-3">
        <div
          className={`flex items-center justify-center w-10 h-10 rounded-xl ${
            count > 0
              ? 'bg-[var(--admin-brand)]/10 text-[var(--admin-brand)]'
              : 'bg-[var(--admin-surface)] text-[var(--admin-text-muted)]'
          }`}
        >
          <Users size={20} strokeWidth={1.5} />
        </div>
        <div>
          <div className="text-2xl font-bold text-[var(--admin-text)] tabular-nums">
            {loading ? '—' : count}
          </div>
          <div className="text-[11px] text-[var(--admin-text-muted)]">
            Active in last 15 min
          </div>
        </div>
      </div>
    </WidgetCard>
  )
}
