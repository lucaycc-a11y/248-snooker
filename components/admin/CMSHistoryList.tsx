'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { tokens } from '@/app/styles/tokens'

export type HistoryRow = {
  id: string
  field_key: string
  locale: string
  old_value: string | null
  new_value: string
  change_source: string
  status: string
  changed_by_email: string | null
  created_at: string | null
}

function statusColor(status: string): string {
  if (status === 'published') return tokens.colors.brand
  if (status === 'reverted') return tokens.colors.textFaint
  return '#eab308'
}

function Row({ row }: { row: HistoryRow }) {
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  async function republish() {
    setBusy(true)
    try {
      const res = await fetch('/api/admin/cms/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version_id: row.id }),
      })
      if (res.ok) setDone(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ padding: tokens.spacing.base, borderBottom: `1px solid ${tokens.colors.border}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: tokens.spacing.sm, flexWrap: 'wrap' }}>
        <div style={{ color: tokens.colors.text, fontSize: 14, fontWeight: 600 }}>
          {row.field_key} · {row.locale}
        </div>
        <div style={{ color: statusColor(row.status), fontSize: 13 }}>
          {row.status} · {row.change_source}
        </div>
      </div>
      <div style={{ color: tokens.colors.textMuted, fontSize: 13, marginTop: 4 }}>
        {row.old_value ?? '—'} <span style={{ color: tokens.colors.textFaint }}>&rarr;</span> {row.new_value}
      </div>
      <div style={{ color: tokens.colors.textFaint, fontSize: 12, marginTop: 4 }}>
        {row.changed_by_email ?? 'unknown'} · {row.created_at ?? ''}
      </div>
      {row.status === 'published' && (
        <div style={{ marginTop: tokens.spacing.sm }}>
          {done ? (
            <span style={{ fontSize: 13, color: tokens.colors.brand }}>Republished</span>
          ) : (
            <Button variant="secondary" size="sm" onClick={republish} loading={busy}>
              Republish this version
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

export default function CMSHistoryList({ rows }: { rows: HistoryRow[] }) {
  return (
    <Card padding="0">
      {rows.map((row) => (
        <Row key={row.id} row={row} />
      ))}
      {rows.length === 0 && (
        <div style={{ padding: tokens.spacing.lg, color: tokens.colors.textMuted, fontSize: 14 }}>No history yet.</div>
      )}
    </Card>
  )
}
