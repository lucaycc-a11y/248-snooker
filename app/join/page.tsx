'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useEffect, Suspense } from 'react'
import { AuthCard } from '@/components/auth/AuthCard'

// /join?room=r1&session=xxx — Guest instant-join flow for Space Pilot.
// Reuses the existing AuthCard/signup form unchanged.
// After successful auth + profile completion, marks the guest_join_requests row completed.
function JoinPageInner() {
  const params = useSearchParams()
  const router = useRouter()
  const room = params.get('room') ?? ''
  const session = params.get('session') ?? ''

  async function onAuthComplete() {
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

        <AuthCard returnUrl={`/join?room=${room}&session=${session}`} onAuthComplete={onAuthComplete} />
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
