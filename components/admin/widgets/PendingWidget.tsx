'use client'

/**
 * PendingWidget — pending admin actions awaiting confirmation.
 *
 * §3.6: Reads admin_action_log WHERE confirmed_by IS NULL.
 * Shows list with confirm/dismiss actions (super_admin only).
 */

import { useEffect, useState } from 'react'
import { Clock, CheckCircle, XCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import WidgetCard from './WidgetCard'
import type { WidgetProps } from '@/lib/admin/widgetRegistry'

type PendingAction = {
  id: string
  action_type: string
  target_table: string
  target_id: string | null
  risk_level: 'low' | 'medium' | 'high'
  created_at: string
}

const RISK_COLORS: Record<string, string> = {
  low: 'bg-[var(--admin-brand)]/10 text-[var(--admin-brand)]',
  medium: 'bg-yellow-500/10 text-yellow-400',
  high: 'bg-red-500/10 text-red-400',
}

export default function PendingWidget({ size }: WidgetProps) {
  const [actions, setActions] = useState<PendingAction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()

    async function fetchPending() {
      try {
        const { data } = await supabase
          .from('admin_action_log')
          .select('id, action_type, target_table, target_id, risk_level, created_at')
          .is('confirmed_by', null)
          .order('created_at', { ascending: false })
          .limit(5)

        if (!cancelled && data) {
          setActions(data as PendingAction[])
        }
      } catch {
        // Table may not exist yet — stays empty
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchPending()
    return () => { cancelled = true }
  }, [])

  return (
    <WidgetCard
      title="Pending Actions"
      cmsKey="widget_pending_items"
      size={size}
      status={loading ? 'stale' : actions.length > 0 ? 'live' : 'live'}
      action={
        actions.length > 0 ? (
          <span className="flex items-center gap-1.5 text-xs text-[var(--admin-brand)] font-medium">
            <Clock size={14} />
            {actions.length}
          </span>
        ) : undefined
      }
    >
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-[var(--admin-text-muted)]">
          <span className="w-4 h-4 rounded-full border-2 border-[var(--admin-brand)] border-t-transparent animate-spin" />
          Loading…
        </div>
      ) : actions.length === 0 ? (
        <p className="text-xs text-[var(--admin-text-muted)] py-4 text-center">
          All clear — no pending actions
        </p>
      ) : (
        <div className="space-y-2">
          {actions.map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--admin-surface)] border border-[var(--admin-border)]"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-[var(--admin-text)] capitalize">
                    {a.action_type.replace(/_/g, ' ')}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${RISK_COLORS[a.risk_level]}`}>
                    {a.risk_level}
                  </span>
                </div>
                <div className="text-[10px] text-[var(--admin-text-muted)] mt-0.5">
                  {a.target_table}{a.target_id ? ` · ${a.target_id.slice(0, 6)}` : ''}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0 ml-2">
                <button
                  type="button"
                  className="p-1 rounded-md text-[var(--admin-brand)] hover:bg-[var(--admin-brand)]/10 transition-colors"
                  aria-label="Confirm action"
                >
                  <CheckCircle size={16} strokeWidth={1.5} />
                </button>
                <button
                  type="button"
                  className="p-1 rounded-md text-[var(--admin-text-muted)] hover:bg-red-500/10 hover:text-red-400 transition-colors"
                  aria-label="Dismiss action"
                >
                  <XCircle size={16} strokeWidth={1.5} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </WidgetCard>
  )
}
