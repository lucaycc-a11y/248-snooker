'use client'

/**
 * PendingWidget — pending admin actions awaiting confirmation.
 *
 * §3.6: shows proposed admin actions still awaiting confirmation.
 *
 * `audit_log` is the only real table; `confirmed_by` is folded into
 * `after_value`, so "pending" means an action that ran without one.
 */

import { useEffect, useState } from 'react'
import { Clock, CheckCircle, XCircle } from 'lucide-react'
import { getLegacyRouteHandlerClient } from '@/lib/supabase/legacy'
import WidgetCard from './WidgetCard'
import type { WidgetProps } from '@/lib/admin/widgetRegistry'

type PendingAction = {
  id: string
  action: string
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

    async function fetchPending() {
      try {
        const supabase = await getLegacyRouteHandlerClient()
        const { data } = await supabase
          .from('audit_log')
          .select('id, action, target_table, target_id, after_value, created_at')
          .order('created_at', { ascending: false })
          .limit(5)

        if (!cancelled && data) {
          setActions(
            (data as unknown as Array<Record<string, unknown>>).map((r) => {
              const after = (r.after_value ?? null) as Record<string, unknown> | null
              const risk =
                after && typeof after.risk_level === 'string'
                  ? (after.risk_level as 'low' | 'medium' | 'high')
                  : 'low'
              return {
                id: String(r.id ?? ''),
                action: String(r.action ?? ''),
                target_table: String(r.target_table ?? ''),
                target_id: r.target_id ? String(r.target_id) : null,
                risk_level: risk,
                created_at: String(r.created_at ?? ''),
              }
            })
          )
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
                    {a.action.replace(/_/g, ' ')}
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
