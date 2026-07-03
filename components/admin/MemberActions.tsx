'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Sheet } from '@/components/ui/Sheet'
import { tokens } from '@/app/styles/tokens'

type Props = {
  userId: string
  currentTier: string
  isBlacklisted: boolean
}

const TIERS = ['amateur', 'century', 'maximum']

type SheetMode = null | 'points' | 'tier' | 'blacklist'

export default function MemberActions({ userId, currentTier, isBlacklisted }: Props) {
  const router = useRouter()
  const [mode, setMode] = useState<SheetMode>(null)
  const [pointsDelta, setPointsDelta] = useState('')
  const [tier, setTier] = useState(currentTier)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function close() {
    setMode(null)
    setReason('')
    setPointsDelta('')
    setError(null)
  }

  async function submit(body: Record<string, unknown>) {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/members/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setError(json.error ?? 'Something went wrong')
        return
      }
      close()
      router.refresh()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ display: 'flex', gap: tokens.spacing.sm, flexWrap: 'wrap', marginBottom: tokens.spacing.lg }}>
      <Button variant="secondary" size="sm" onClick={() => setMode('points')}>
        Adjust points
      </Button>
      <Button variant="secondary" size="sm" onClick={() => setMode('tier')}>
        Change tier
      </Button>
      <Button variant="secondary" size="sm" onClick={() => setMode('blacklist')}>
        {isBlacklisted ? 'Remove from blacklist' : 'Blacklist member'}
      </Button>

      <Sheet open={mode === 'points'} onClose={close}>
        <h3 style={{ color: tokens.colors.text, fontSize: 18, fontWeight: 700, marginBottom: tokens.spacing.md }}>
          Adjust points
        </h3>
        <Input
          type="number"
          placeholder="+/- points (e.g. -50 or 100)"
          value={pointsDelta}
          onChange={(e) => setPointsDelta(e.target.value)}
        />
        <div style={{ marginTop: tokens.spacing.sm }}>
          <Input placeholder="Reason (required)" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        {error && <div style={{ color: tokens.colors.danger, fontSize: 13, marginTop: 8 }}>{error}</div>}
        <div style={{ display: 'flex', gap: tokens.spacing.sm, marginTop: tokens.spacing.md }}>
          <Button
            variant="primary"
            size="sm"
            loading={submitting}
            disabled={!pointsDelta || !reason.trim()}
            onClick={() => submit({ action: 'adjust_points', delta: Number(pointsDelta), reason })}
          >
            Save
          </Button>
          <Button variant="ghost" size="sm" onClick={close}>
            Cancel
          </Button>
        </div>
      </Sheet>

      <Sheet open={mode === 'tier'} onClose={close}>
        <h3 style={{ color: tokens.colors.text, fontSize: 18, fontWeight: 700, marginBottom: tokens.spacing.md }}>
          Change tier
        </h3>
        <select
          value={tier}
          onChange={(e) => setTier(e.target.value)}
          style={{
            width: '100%',
            height: 52,
            padding: '0 14px',
            backgroundColor: 'rgba(255,255,255,0.06)',
            border: `1px solid ${tokens.colors.border}`,
            borderRadius: tokens.radius.input,
            color: tokens.colors.text,
            fontSize: 15,
          }}
        >
          {TIERS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <div style={{ marginTop: tokens.spacing.sm }}>
          <Input placeholder="Reason (required)" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        {error && <div style={{ color: tokens.colors.danger, fontSize: 13, marginTop: 8 }}>{error}</div>}
        <div style={{ display: 'flex', gap: tokens.spacing.sm, marginTop: tokens.spacing.md }}>
          <Button
            variant="primary"
            size="sm"
            loading={submitting}
            disabled={!reason.trim()}
            onClick={() => submit({ action: 'set_tier', tier, reason })}
          >
            Save
          </Button>
          <Button variant="ghost" size="sm" onClick={close}>
            Cancel
          </Button>
        </div>
      </Sheet>

      <Sheet open={mode === 'blacklist'} onClose={close}>
        <h3 style={{ color: tokens.colors.text, fontSize: 18, fontWeight: 700, marginBottom: tokens.spacing.md }}>
          {isBlacklisted ? 'Remove from blacklist' : 'Blacklist member'}
        </h3>
        <Input placeholder="Reason (required)" value={reason} onChange={(e) => setReason(e.target.value)} />
        {error && <div style={{ color: tokens.colors.danger, fontSize: 13, marginTop: 8 }}>{error}</div>}
        <div style={{ display: 'flex', gap: tokens.spacing.sm, marginTop: tokens.spacing.md }}>
          <Button
            variant="primary"
            size="sm"
            loading={submitting}
            disabled={!reason.trim()}
            onClick={() => submit({ action: 'toggle_blacklist', blacklisted: !isBlacklisted, reason })}
          >
            Confirm
          </Button>
          <Button variant="ghost" size="sm" onClick={close}>
            Cancel
          </Button>
        </div>
      </Sheet>
    </div>
  )
}
