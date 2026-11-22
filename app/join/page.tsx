'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AuthCard } from '@/components/auth/AuthCard'

// /join?room=r1&session=xxx — Guest instant-join flow for Space Pilot.
// Reuses the existing AuthCard/signup form unchanged.
// After successful auth + profile completion, marks the guest_join_requests row completed.
function JoinPageInner() {
  const params = useSearchParams()
  const router = useRouter()
  const room = params.get('room') ?? ''
  const session = params.get('session') ?? ''
  // /join?c=<code> — a friend scanned the Space Pilot QR on the iPad.
  const code = (params.get('c') ?? '').toUpperCase()
  const [claim, setClaim] = useState<'idle' | 'done' | 'expired' | 'error'>('idle')

  // Links this account to the table. Returns true when the seat was claimed.
  async function claimSeat(): Promise<boolean> {
    if (!code) return false
    try {
      const res = await fetch('/api/member/pilot/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      setClaim(res.ok ? 'done' : res.status === 410 || res.status === 404 ? 'expired' : 'error')
      return res.ok
    } catch {
      setClaim('error')
      return false
    }
  }

  // Already signed in on this phone? Join straight away, no form.
  useEffect(() => {
    if (!code) return
    let cancelled = false
    void createClient()
      .auth.getUser()
      .then(({ data }) => {
        if (!cancelled && data.user) void claimSeat()
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  async function onAuthComplete() {
    // Space Pilot QR: after login or registration, claim the seat and stay on this page
    // so the friend sees the confirmation.
    if (code) {
      await claimSeat()
      return
    }
    // If a matching pending guest_join_request exists, mark it completed.
    // This is best-effort — a failure here should never block the user.
    if (room && session) {
      try {
        await fetch('/api/pilot/complete-guest-join', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ room, session }),
        })
      } catch {
        // Non-fatal — continue regardless.
      }
    }
    router.replace('/member')
  }

  return (
    <section
      style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        background: '#000',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 400,
          padding: 40,
          borderRadius: 20,
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.10)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <img
            src="/logos/logo-white-mark.svg"
            alt="Space8"
            style={{ height: 44, width: 'auto', marginBottom: 16 }}
          />
          <p
            style={{
              color: 'rgba(255,255,255,0.55)',
              fontSize: 14,
              margin: 0,
              fontFamily: "'Noto Sans TC', sans-serif",
            }}
          >
            即場加入，開始記錄你的每一場勝利
          </p>
        </div>

        {claim === 'done' ? (
          <div style={{ textAlign: 'center', color: '#fff', fontFamily: "'Noto Sans TC', sans-serif" }}>
            <p style={{ fontSize: 20, fontWeight: 700, margin: '0 0 8px' }}>已加入檯面！</p>
            <p style={{ margin: '0 0 20px', color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>
              返去 iPad 繼續，你嘅名已經喺玩家名單。
            </p>
            <button
              type="button"
              onClick={() => router.replace('/member?tab=pilot')}
              style={{ minHeight: 48, padding: '0 24px', borderRadius: 14, background: '#fff', color: '#000', fontWeight: 600 }}
            >
              前往會員中心
            </button>
          </div>
        ) : (
          <>
            {claim === 'expired' && (
              <p style={{ color: '#ffb3b3', fontSize: 14, textAlign: 'center', margin: '0 0 16px' }}>
                呢個加入碼已過期，請喺 iPad 重新顯示 QR。
              </p>
            )}
            {claim === 'error' && (
              <p style={{ color: '#ffb3b3', fontSize: 14, textAlign: 'center', margin: '0 0 16px' }}>
                暫時未能加入，請再試一次。
              </p>
            )}
            <AuthCard
              returnUrl={code ? `/join?c=${code}` : `/join?room=${room}&session=${session}`}
              onAuthComplete={onAuthComplete}
            />
          </>
        )}
      </div>
    </section>
  )
}

export default function JoinPage() {
  return (
    <Suspense>
      <JoinPageInner />
    </Suspense>
  )
}
