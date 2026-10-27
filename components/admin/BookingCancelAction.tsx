'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/admin/ui/Button'
import { Input } from '@/components/ui/input'
import { Sheet } from '@/components/ui/sheet'
import { adminTokens as tokens } from '@/lib/admin/admin-tokens'

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
        setError(json.error ?? '操作失敗，請稍後再試')
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
      <Button variant={compact ? 'danger' : 'secondary'} onClick={() => setOpen(true)} style={compact ? undefined : { marginBottom: tokens.spacing.lg }}>
        取消預約
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)}>
        <h3 style={{ color: tokens.colors.text, fontSize: 18, fontWeight: 700, marginBottom: tokens.spacing.md }}>
          取消這張預約
        </h3>
        <p style={{ color: tokens.colors.textMuted, fontSize: 13, marginBottom: tokens.spacing.sm }}>
          這會釋放房間時段，並把預約標記為「後台已取消」。此操作不會自動退款；如需把款項退回客人，請另行處理。
        </p>
        <Input placeholder="取消原因（必填）" value={reason} onChange={(e) => setReason(e.target.value)} />
        {error ? <div style={{ color: tokens.colors.danger, fontSize: 13, marginTop: 8 }}>{error}</div> : null}
        <div style={{ display: 'flex', gap: tokens.spacing.sm, marginTop: tokens.spacing.md }}>
          <Button variant="primary" disabled={submitting || !reason.trim()} onClick={submit}>
            {submitting ? '取消中…' : '確認取消'}
          </Button>
          <Button variant="secondary" onClick={() => setOpen(false)}>
            返回
          </Button>
        </div>
      </Sheet>
    </>
  )
}
