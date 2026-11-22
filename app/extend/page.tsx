'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AuthCard } from '@/components/auth/AuthCard'

// /extend?b=<booking id> — opened from the QR on the iPad when time is almost up.
// Finds the hour right after the running booking, then continues in the normal /book
// flow, so payment (methods, promo, wallet, KPay/Stripe) is the same as any booking.
type Phase = 'checking' | 'login' | 'redirecting' | 'taken' | 'ended' | 'error'

function isSlot(value: unknown): value is { date: string; startHour: number; tableNumber: number } {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return typeof v.date === 'string' && typeof v.startHour === 'number' && typeof v.tableNumber === 'number'
}

function ExtendInner() {
  const params = useSearchParams()
  const booking = params.get('b') ?? ''
  const [phase, setPhase] = useState<Phase>('checking')

  const proceed = useCallback(async () => {
    setPhase('checking')
    try {
      const res = await fetch(`/api/member/pilot/extend?b=${encodeURIComponent(booking)}`, { cache: 'no-store' })
      if (res.status === 401) return setPhase('login')
      if (res.status === 409) return setPhase('taken')
      if (res.status === 404 || res.status === 400) return setPhase('ended')
      const slot: unknown = await res.json().catch(() => null)
      if (!res.ok || !isSlot(slot)) return setPhase('error')
      // Same shape /book keeps for an in-progress selection: one `${table}:${hour}` key.
      sessionStorage.setItem(
        'bookingSelection',
        JSON.stringify({
          entries: [{ date: slot.date, slots: [`${slot.tableNumber}:${slot.startHour}`] }],
          updatedAt: Date.now(),
        }),
      )
      setPhase('redirecting')
      window.location.href = '/book'
    } catch {
      setPhase('error')
    }
  }, [booking])

  useEffect(() => {
    if (!booking) return setPhase('ended')
    void createClient()
      .auth.getUser()
      .then(({ data }) => (data.user ? proceed() : setPhase('login')))
  }, [booking, proceed])

  const box: React.CSSProperties = {
    minHeight: '100dvh', background: '#000', color: '#fff', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, textAlign: 'center',
    fontFamily: "'Good Times', 'Noto Sans TC', system-ui, sans-serif",
  }
  const message: Record<Exclude<Phase, 'login'>, string> = {
    checking: '檢查緊時段…',
    redirecting: '前往付款…',
    taken: '下一個時段已經有人預約，暫時未能續時。',
    ended: '呢個預約已經完結或搵唔到。',
    error: '暫時未能處理，請稍後再試。',
  }

  if (phase === 'login') {
    return (
      <main style={box}>
        <AuthCard returnUrl={`/extend?b=${booking}`} onAuthComplete={proceed} />
      </main>
    )
  }
  return (
    <main style={box}>
      <p style={{ fontSize: 18, margin: 0 }}>{message[phase]}</p>
      {phase === 'error' && (
        <button type="button" onClick={() => void proceed()} style={{ minHeight: 48, padding: '0 24px', borderRadius: 14 }}>
          重試
        </button>
      )}
    </main>
  )
}

export default function ExtendPage() {
  return (
    <Suspense fallback={null}>
      <ExtendInner />
    </Suspense>
  )
}
