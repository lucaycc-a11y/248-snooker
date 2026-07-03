'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { tokens } from '@/app/styles/tokens'
import { CMSEditCard, type ProposedEdit } from './CMSEditCard'

export default function AIChat() {
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [edits, setEdits] = useState<ProposedEdit[]>([])
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    if (!prompt.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/cms/ai-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      })
      const json: unknown = await res.json().catch(() => null)
      if (!res.ok) {
        const errorCode =
          json && typeof json === 'object' && 'error' in json && typeof (json as { error: unknown }).error === 'string'
            ? (json as { error: string }).error
            : 'Request failed'
        setError(errorCode === 'vectorengine_not_configured' ? "AI isn't set up yet — contact the site admin." : errorCode)
        return
      }
      const payload = json as { edits?: ProposedEdit[] }
      setEdits(payload.edits ?? [])
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <Card style={{ marginBottom: tokens.spacing.lg }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: tokens.colors.text, marginBottom: tokens.spacing.md }}>
          Describe the change
        </div>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g. Make the homepage headline more energetic"
          rows={4}
          style={{
            width: '100%',
            padding: 14,
            backgroundColor: 'rgba(255,255,255,0.06)',
            border: `1px solid ${tokens.colors.border}`,
            borderRadius: tokens.radius.input,
            color: tokens.colors.text,
            fontSize: 15,
            fontFamily: tokens.font.sans,
            resize: 'vertical',
            marginBottom: tokens.spacing.md,
          }}
        />
        <Button variant="primary" size="md" onClick={submit} loading={loading} disabled={!prompt.trim()}>
          Propose changes
        </Button>
        {error && (
          <div style={{ color: tokens.colors.danger, fontSize: 13, marginTop: tokens.spacing.sm }}>{error}</div>
        )}
      </Card>

      {edits.map((edit, i) => (
        <CMSEditCard key={`${edit.field_key}-${edit.locale}-${i}`} edit={edit} />
      ))}

      <div style={{ marginTop: tokens.spacing.xl, fontSize: 11, color: tokens.colors.textFaint }}>
        AI Provided by FORM
        <br />
        Powered by Claude Sonnet 5 &amp; Claude Opus 4.8
      </div>
    </div>
  )
}
