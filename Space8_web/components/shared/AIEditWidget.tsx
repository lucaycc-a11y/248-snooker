'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { tokens } from '@/app/styles/tokens'
import { CMSEditCard, type ProposedEdit } from '@/components/admin/CMSEditCard'

// Admin-in-edit-mode variant of the floating contact button (Phase C merge).
// Same floating position as WhatsAppButton; opens a Sheet with the SAME
// natural-language-to-CMS-edit flow as /admin/cms/ai, calling the existing
// ai-edit route unchanged.
export default function AIEditWidget() {
  const [open, setOpen] = useState(false)
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
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="AI edit"
        className="md:hidden"
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 50,
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: tokens.colors.brand,
          color: '#000000',
          border: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          fontSize: 20,
        }}
      >
        AI
      </button>

      <Sheet open={open} onClose={() => setOpen(false)}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close"
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: tokens.colors.text, marginBottom: tokens.spacing.md }}>
          Describe the change
        </div>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g. Make this page's headline more energetic"
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
        {error && <div style={{ color: tokens.colors.danger, fontSize: 13, marginTop: tokens.spacing.sm }}>{error}</div>}

        <div style={{ marginTop: tokens.spacing.md, maxHeight: 300, overflowY: 'auto' }}>
          {edits.map((edit, i) => (
            <CMSEditCard key={`${edit.field_key}-${edit.locale}-${i}`} edit={edit} />
          ))}
        </div>

        <div style={{ marginTop: tokens.spacing.md, fontSize: 11, color: tokens.colors.textFaint, textAlign: 'center' }}>
          AI Provided by FORM
        </div>
      </Sheet>
    </>
  )
}
