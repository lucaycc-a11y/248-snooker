'use client'

/**
 * AnomalyWidget — payment anomaly alerts.
 *
 * §3.5: Shows payments with no matching confirmed booking.
 * Greys out (dimmed) when 0 anomalies.
 */

import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import WidgetCard from './WidgetCard'
import type { WidgetProps } from '@/lib/admin/widgetRegistry'

type Anomaly = {
  id: string
  amount: number
  created_at: string
  provider_order_no: string | null
}

export default function AnomalyWidget({ size }: WidgetProps) {
  const [anomalies, setAnomalies] = useState<Anomaly[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()

    async function fetchAnomalies() {
      try {
        // Payments that exist but have no matching confirmed booking
        const { data } = await supabase
          .from('payment_attempts')
          .select('id, amount, created_at, provider_order_no')
          .eq('status', 'completed')
          .is('booking_id', null)
          .order('created_at', { ascending: false })
          .limit(5)

        if (!cancelled && data) {
          setAnomalies(data as Anomaly[])
        }
      } catch {
        // Table may not have booking_id column — stays empty
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchAnomalies()
    return () => { cancelled = true }
  }, [])

  const count = anomalies.length

  return (
    <WidgetCard
      title="Anomaly Alerts"
      cmsKey="widget_anomaly_alert"
      size={size}
      status={loading ? 'stale' : count > 0 ? 'error' : 'live'}
    >
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-[var(--admin-text-muted)]">
          <span className="w-4 h-4 rounded-full border-2 border-[var(--admin-brand)] border-t-transparent animate-spin" />
          Checking…
        </div>
      ) : count === 0 ? (
        <div className="flex flex-col items-center py-4 opacity-50">
          <AlertTriangle size={24} className="text-[var(--admin-text-muted)] mb-2" />
          <p className="text-xs text-[var(--admin-text-muted)]">No anomalies detected</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-[var(--admin-text-muted)] mb-2">
            {count} payment{count !== 1 ? 's' : ''} without a matching booking
          </p>
          {anomalies.map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between p-2 rounded-lg bg-[var(--admin-surface)] border border-[var(--admin-border)]"
            >
              <div className="min-w-0">
                <div className="text-xs font-medium text-[var(--admin-text)] truncate">
                  ${a.amount.toLocaleString('en-HK')}
                </div>
                <div className="text-[10px] text-[var(--admin-text-muted)] font-mono truncate">
                  {a.provider_order_no ?? a.id.slice(0, 8)}
                </div>
              </div>
              <span className="text-[10px] text-[var(--admin-text-muted)] shrink-0 ml-2">
                {new Date(a.created_at).toLocaleDateString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </WidgetCard>
  )
}
