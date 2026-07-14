'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { tokens } from '@/app/styles/tokens'

export type ProposedEdit = {
  version_id: string
  field_key: string
  locale: string
  old_value: string | null
  new_value: string
  reasoning: string
}

type PublishState = 'idle' | 'publishing' | 'published' | 'error'

// Shared before/after diff card with a "Publish now" button — used by both
// the admin /admin/cms/ai panel and the merged AI-edit widget on the public
// site (Phase C). Publishes via the existing cms/publish route (Phase 6),
// unmodified.
export function CMSEditCard({ edit }: { edit: ProposedEdit }) {
  const [state, setState] = useState<PublishState>('idle')

  async function publish() {
    setState('publishing')
    try {
      const res = await fetch('/api/admin/cms/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version_id: edit.version_id }),
      })
      setState(res.ok ? 'published' : 'error')
    } catch {
      setState('error')
    }
  }

  return (
    <Card style={{ marginBottom: tokens.spacing.md }}>
      <div style={{ fontSize: 13, color: tokens.colors.textMuted, marginBottom: 4 }}>
        {edit.field_key} · {edit.locale}
      </div>
      <div style={{ fontSize: 14, color: tokens.colors.textMuted, marginBottom: 4 }}>Before</div>
      <div style={{ fontSize: 14, color: tokens.colors.text, marginBottom: 8 }}>{edit.old_value ?? '—'}</div>
      <div style={{ fontSize: 14, color: tokens.colors.textMuted, marginBottom: 4 }}>After</div>
      <div style={{ fontSize: 14, color: tokens.colors.text, marginBottom: 8 }}>{edit.new_value}</div>
      <div style={{ fontSize: 13, color: tokens.colors.textFaint, marginBottom: tokens.spacing.md }}>
        {edit.reasoning}
      </div>
      <div style={{ display: 'flex', gap: tokens.spacing.sm, alignItems: 'center' }}>
        {state === 'published' ? (
          <span style={{ fontSize: 13, color: tokens.colors.brand }}>Published</span>
        ) : (
          <>
            <span style={{ fontSize: 13, color: tokens.colors.textMuted }}>Saved as draft</span>
            {state === 'error' && <span style={{ fontSize: 13, color: tokens.colors.danger }}>Publish failed</span>}
            <Button
              variant="primary"
              size="sm"
              onClick={publish}
              loading={state === 'publishing'}
              style={{ marginLeft: 'auto' }}
            >
              Publish now
            </Button>
          </>
        )}
      </div>
    </Card>
  )
}
