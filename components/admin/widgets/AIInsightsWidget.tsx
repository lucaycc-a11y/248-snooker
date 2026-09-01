'use client'

/**
 * AIInsightsWidget — displays pre-generated daily AI insights.
 *
 * §3.4: Reads from `ai_daily_insights` table (never live-calls AI).
 * Shows summary text + key metrics from the JSONB payload.
 * Falls back to "No insights yet" if no data.
 */

import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import WidgetCard from './WidgetCard'
import type { WidgetProps } from '@/lib/admin/widgetRegistry'

type InsightPayload = {
  summary?: string
  highlights?: string[]
  generated_at?: string
}

export default function AIInsightsWidget({ size }: WidgetProps) {
  const [insight, setInsight] = useState<InsightPayload | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()

    async function fetchInsight() {
      try {
        const { data } = await supabase
          .from('ai_daily_insights')
          .select('insights, generated_at')
          .order('date', { ascending: false })
          .limit(1)
          .single()

        if (!cancelled && data) {
          setInsight({
            ...(data.insights as InsightPayload),
            generated_at: data.generated_at,
          })
        }
      } catch {
        // Table may not exist yet — stays null
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchInsight()
    return () => { cancelled = true }
  }, [])

  return (
    <WidgetCard
      title="AI Insights"
      cmsKey="widget_ai_insights"
      size={size}
      status={loading ? 'stale' : insight ? 'live' : 'error'}
      action={
        <Sparkles size={16} className="text-[var(--admin-brand)] opacity-60" />
      }
    >
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-[var(--admin-text-muted)]">
          <span className="w-4 h-4 rounded-full border-2 border-[var(--admin-brand)] border-t-transparent animate-spin" />
          Loading…
        </div>
      ) : insight ? (
        <div className="space-y-3">
          {/* Summary */}
          {insight.summary && (
            <p className="text-sm text-[var(--admin-text)] leading-relaxed">
              {insight.summary}
            </p>
          )}

          {/* Highlights */}
          {insight.highlights && insight.highlights.length > 0 && (
            <ul className="space-y-1.5">
              {insight.highlights.slice(0, 4).map((h, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-[var(--admin-text-muted)]">
                  <span className="text-[var(--admin-brand)] mt-0.5 shrink-0">•</span>
                  <span>{h}</span>
                </li>
              ))}
            </ul>
          )}

          {/* Timestamp */}
          {insight.generated_at && (
            <p className="text-[10px] text-[var(--admin-text-muted)] opacity-60 pt-1">
              Generated {new Date(insight.generated_at).toLocaleDateString()}
            </p>
          )}
        </div>
      ) : (
        <p className="text-xs text-[var(--admin-text-muted)] italic">
          No insights available yet. Insights are generated daily.
        </p>
      )}
    </WidgetCard>
  )
}
