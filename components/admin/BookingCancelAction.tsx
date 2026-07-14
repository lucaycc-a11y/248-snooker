'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Sheet } from '@/components/ui/Sheet'
import { tokens } from '@/app/styles/tokens'

export default function BookingCancelAction({ bookingId, compact = false }: { bookingId: string; compact?: boolean }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel', reason }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setError(json.error ?? 'Something went wrong')
        return
      }
      setOpen(false)
      setReason('')
      router.refresh()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)} style={compact ? undefined : { marginBottom: tokens.spacing.lg }}>
        Cancel booking (admin)
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)}>
        <h3 style={{ color: tokens.colors.text, fontSize: 18, fontWeight: 700, marginBottom: tokens.spacing.md }}>
          Cancel this booking
        </h3>
        <p style={{ color: tokens.colors.textMuted, fontSize: 13, marginBottom: tokens.spacing.sm }}>
          This releases the table slot and marks the booking as admin-cancelled. It does not process a Stripe
          refund — use the refund flow instead if money needs to go back.
        </p>
        <Input placeholder="Reason (required)" value={reason} onChange={(e) => setReason(e.target.value)} />
        {error && <div style={{ color: tokens.colors.danger, fontSize: 13, marginTop: 8 }}>{error}</div>}
        <div style={{ display: 'flex', gap: tokens.spacing.sm, marginTop: tokens.spacing.md }}>
          <Button variant="primary" size="sm" loading={submitting} disabled={!reason.trim()} onClick={submit}>
            Confirm cancel
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Back
          </Button>
        </div>
      </Sheet>
    </>
  )
}
