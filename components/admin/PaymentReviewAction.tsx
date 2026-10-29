'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/admin/ui/Button'
import { Input } from '@/components/ui/input'
import { Sheet } from '@/components/ui/sheet'
import { adminTokens as tokens } from '@/lib/admin/admin-tokens'

type Decision = 'confirm' | 'refunded'

const COPY: Record<Decision, { title: string; body: string; cta: string }> = {
  confirm: {
    title: '確認這張預約',
    body: '系統會再檢查時段：仍然空置就會確認預約並通知客人；如果時段已被其他客人佔用，會維持「待審核」，請改用「已退款」。',
    cta: '確認預約',
  },
  refunded: {
    title: '標記為已退款',
    body: '請先在 KPay 後台把款項退回客人，之後才在這裡標記。預約會關閉，此操作本系統不會自動退款。',
    cta: '已退款，關閉預約',
  },
}

export default function PaymentReviewAction({ bookingId }: { bookingId: string }) {
  const router = useRouter()
  const [decision, setDecision] = useState<Decision | null>(null)
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    if (!decision) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, note }),
      })
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setError(json.error ?? '操作失敗，請稍後再試')
        return
      }
      setDecision(null)
      setNote('')
      router.refresh()
    } finally {
      setSubmitting(false)
    }
  }

  const copy = decision ? COPY[decision] : null
  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: tokens.spacing.sm }}>
        <Button variant="primary" onClick={() => { setError(null); setDecision('confirm') }}>確認預約</Button>
        <Button variant="secondary" onClick={() => { setError(null); setDecision('refunded') }}>已退款（關閉）</Button>
      </div>
      <Sheet open={decision !== null} onClose={() => setDecision(null)}>
        <h3 style={{ color: tokens.colors.text, fontSize: 18, fontWeight: 700, marginBottom: tokens.spacing.md }}>{copy?.title}</h3>
        <p style={{ color: tokens.colors.textMuted, fontSize: 14, lineHeight: 1.6, marginBottom: tokens.spacing.sm }}>{copy?.body}</p>
        <Input placeholder="備註（必填，例如：已 WhatsApp 客人／KPay 退款單號）" value={note} onChange={(e) => setNote(e.target.value)} />
        {error ? <div style={{ color: tokens.colors.danger, fontSize: 14, marginTop: 8 }}>{error}</div> : null}
        <div style={{ display: 'flex', gap: tokens.spacing.sm, marginTop: tokens.spacing.md }}>
          <Button variant="primary" disabled={submitting || note.trim().length < 3} onClick={submit}>
            {submitting ? '處理中…' : copy?.cta}
          </Button>
          <Button variant="secondary" onClick={() => setDecision(null)}>返回</Button>
        </div>
      </Sheet>
    </>
  )
}
