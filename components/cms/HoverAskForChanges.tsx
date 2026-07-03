'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Space8Loader } from '@/components/ui/Space8Loader'
import { tokens } from '@/app/styles/tokens'
import { CMSEditCard, type ProposedEdit } from '@/components/admin/CMSEditCard'

// Inline "Ask for changes" panel rendered by HoverToolbar on click. Calls the
// EXISTING /api/admin/cms/ai-edit route (unchanged validation/blocklist/rate
// limit), just with scoped context (cmsKey/locale/currentValue) so the AI
// prefers proposing an edit to this exact field. Reuses CMSEditCard's
// existing publish-button logic rather than re-deriving it.

type State = 'idle' | 'loading' | 'done' | 'error'

export function HoverAskForChanges({
  cmsKey,
  locale,
  currentValue,
  onClose,
}: {
  cmsKey: string
  locale: string
  currentValue: string
  onClose: () => void
}) {
  const [prompt, setPrompt] = useState('')
  const [state, setState] = useState<State>('idle')
  const [edits, setEdits] = useState<ProposedEdit[]>([])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function submit() {
    if (!prompt.trim()) return
    setState('loading')
    setErrorMessage(null)
    try {
      const res = await fetch('/api/admin/cms/ai-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          scopedKey: cmsKey,
          scopedLocale: locale,
          scopedCurrentValue: currentValue,
        }),
      })
      const json: unknown = await res.json().catch(() => null)
      if (!res.ok) {
        const errorCode =
          json && typeof json === 'object' && 'error' in json && typeof (json as { error: unknown }).error === 'string'
            ? (json as { error: string }).error
            : 'Request failed'
        setErrorMessage(errorCode === 'vectorengine_not_configured' ? "AI isn't set up yet — contact the site admin." : errorCode)
        setState('error')
        return
      }
      const payload = json as { edits?: ProposedEdit[] }
      const found = payload.edits ?? []
      if (found.length === 0) {
        setErrorMessage("I couldn't figure out what to change — try being more specific.")
        setState('error')
        return
      }
      setEdits(found)
      setState('done')
    } catch {
      setErrorMessage('Network error')
      setState('error')
    }
  }

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '100%',
        left: 0,
        marginBottom: 4,
        width: 320,
        maxWidth: '80vw',
        padding: tokens.spacing.md,
        backgroundColor: tokens.colors.surfaceElevated,
        border: `1px solid ${tokens.colors.borderStrong}`,
        borderRadius: tokens.radius.button,
        zIndex: 60,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: tokens.spacing.sm }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: tokens.colors.text }}>Ask for changes</span>
        <button
          onClick={onClose}
          aria-label="Close"
          style={{ background: 'none', border: 'none', color: tokens.colors.textMuted, cursor: 'pointer', fontSize: 16 }}
        >
          &times;
        </button>
      </div>

      {state === 'loading' ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0' }}>
          <Space8Loader size={18} theme="light" />
          <span style={{ fontSize: 13, color: tokens.colors.textMuted }}>Thinking…</span>
        </div>
      ) : state === 'done' ? (
        <div style={{ maxHeight: 260, overflowY: 'auto' }}>
          {edits.map((edit, i) => (
            <CMSEditCard key={`${edit.field_key}-${edit.locale}-${i}`} edit={edit} />
          ))}
        </div>
      ) : (
        <>
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit()
            }}
            placeholder="Tell me what to change..."
            disabled={state === ('loading' as State)}
            style={{
              width: '100%',
              height: 40,
              padding: '0 12px',
              backgroundColor: 'rgba(255,255,255,0.06)',
              border: `1px solid ${tokens.colors.border}`,
              borderRadius: tokens.radius.input,
              color: tokens.colors.text,
              fontSize: 14,
              marginBottom: tokens.spacing.sm,
            }}
          />
          {errorMessage && (
            <div style={{ color: tokens.colors.danger, fontSize: 12, marginBottom: tokens.spacing.sm }}>{errorMessage}</div>
          )}
          <Button variant="primary" size="sm" onClick={submit} disabled={!prompt.trim()} fullWidth>
            Submit
          </Button>
        </>
      )}
    </div>
  )
}
