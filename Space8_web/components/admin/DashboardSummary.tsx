'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { tokens } from '@/app/styles/tokens'

export default function DashboardSummary() {
  const [summary, setSummary] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function fetchSummary() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/ai/summary')
      const json: unknown = await res.json().catch(() => null)
      if (!res.ok) {
        const errorCode =
          json && typeof json === 'object' && 'error' in json && typeof (json as { error: unknown }).error === 'string'
            ? (json as { error: string }).error
            : null
        setSummary(
          errorCode === 'vectorengine_not_configured'
            ? "AI isn't set up yet — contact the site admin."
            : 'Unable to generate a summary right now.'
        )
        return
      }
      const text =
        json && typeof json === 'object' && 'summary' in json && typeof (json as { summary: unknown }).summary === 'string'
          ? (json as { summary: string }).summary
          : 'Unable to generate a summary right now.'
      setSummary(text)
    } catch {
      setSummary('Unable to generate a summary right now.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card style={{ marginBottom: tokens.spacing.lg }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: tokens.spacing.md }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: tokens.colors.text }}>Today&apos;s summary</div>
        <Button variant="secondary" size="sm" onClick={fetchSummary} loading={loading}>
          {summary ? 'Refresh' : 'Generate'}
        </Button>
      </div>
      {summary && (
        <div style={{ marginTop: tokens.spacing.md, fontSize: 14, color: tokens.colors.textMuted, lineHeight: 1.6 }}>
          {summary}
        </div>
      )}
    </Card>
  )
}
