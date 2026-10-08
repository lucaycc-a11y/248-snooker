'use client'

import { useRef, useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { Starfield } from '@/app/[locale]/Starfield'
import { AmbientGlow } from '@/components/shared/AmbientGlow'
import { Logo } from '@/components/brand/Logo'
import { PasswordInput } from '@/components/shared/PasswordInput'

const GREEN = '#22c55e'
const LONG_PRESS_MS = 2500

// Must match the actual go-live time
const LAUNCH_AT = '2026-10-13T10:00:00+08:00'

type GateReason = 'prelaunch' | 'maintenance'

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export function getRemaining(now: number, target: number): {
  days: number
  hours: number
  minutes: number
  seconds: number
  total: number
} {
  const total = Math.max(0, target - now)
  const days = Math.floor(total / (1000 * 60 * 60 * 24))
  const hours = Math.floor((total % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((total % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((total % (1000 * 60)) / 1000)
  return { days, hours, minutes, seconds, total }
}

function Countdown() {
  const t = useTranslations('comingSoon')
  const [mounted, setMounted] = useState(false)
  const [remaining, setRemaining] = useState(() => getRemaining(Date.now(), new Date(LAUNCH_AT).getTime()))
  const [isPolling, setIsPolling] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return

    const targetTime = new Date(LAUNCH_AT).getTime()

    const tick = () => {
      const now = Date.now()
      const rem = getRemaining(now, targetTime)
      setRemaining(rem)

      if (rem.total === 0 && intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
        setIsPolling(true)
      }
    }

    tick()
    intervalRef.current = setInterval(tick, 1000)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [mounted])

  useEffect(() => {
    if (!isPolling) return

    const poll = async () => {
      try {
        const res = await fetch('/', { method: 'HEAD', redirect: 'manual' })
        if (res.type !== 'opaqueredirect') {
          window.location.assign('/')
        }
      } catch {
        // Ignore
      }
    }

    poll()
    pollIntervalRef.current = setInterval(poll, 10000)

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
    }
  }, [isPolling])

  if (!mounted) {
    return <div style={{ height: 120 }} />
  }

  const prefersReducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  if (remaining.total === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', marginBottom: 24 }}>
        <p
          data-cms-key="comingSoon.live_now"
          style={{ color: GREEN, fontSize: 18, fontWeight: 600, textAlign: 'center' }}
        >
          {t('live_now')}
        </p>
        <a
          href="/"
          data-cms-key="comingSoon.enter_site"
          style={{
            display: 'inline-block',
            padding: '12px 24px',
            borderRadius: 9999,
            background: GREEN,
            color: '#000',
            fontWeight: 700,
            fontSize: 16,
            textDecoration: 'none',
          }}
        >
          {t('enter_site')}
        </a>
      </div>
    )
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: GREEN,
    fontWeight: 600,
  }

  const boxStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(34,197,94,0.2)',
    borderRadius: 8,
    padding: '12px 8px',
    minWidth: 64,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    transition: prefersReducedMotion ? 'none' : 'border-color 0.2s',
  }

  const numberStyle: React.CSSProperties = {
    fontSize: 28,
    fontWeight: 700,
    color: '#fff',
    fontVariantNumeric: 'tabular-nums',
    lineHeight: 1,
  }

  return (
    <div style={{ marginBottom: 24 }} aria-live="off">
      <time dateTime={LAUNCH_AT} style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden' }}>
        Launch: {LAUNCH_AT}
      </time>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
        <div style={boxStyle}>
          <div style={numberStyle}>{String(remaining.days).padStart(2, '0')}</div>
          <div style={labelStyle} data-cms-key="comingSoon.cd_days">
            {t('cd_days')}
          </div>
        </div>
        <div style={boxStyle}>
          <div style={numberStyle}>{String(remaining.hours).padStart(2, '0')}</div>
          <div style={labelStyle} data-cms-key="comingSoon.cd_hours">
            {t('cd_hours')}
          </div>
        </div>
        <div style={boxStyle}>
          <div style={numberStyle}>{String(remaining.minutes).padStart(2, '0')}</div>
          <div style={labelStyle} data-cms-key="comingSoon.cd_minutes">
            {t('cd_minutes')}
          </div>
        </div>
        <div style={boxStyle}>
          <div style={numberStyle}>{String(remaining.seconds).padStart(2, '0')}</div>
          <div style={labelStyle} data-cms-key="comingSoon.cd_seconds">
            {t('cd_seconds')}
          </div>
        </div>
      </div>
    </div>
  )
}

// The "Notify Me" button doubles as the hidden gate trigger: holding it down
// for LONG_PRESS_MS opens the password modal instead of submitting the
// waitlist form. type="button" (not "submit") so we fully control whether a
// press results in a form submit or a long-press activation — a native
// submit button would fire its click/submit on release regardless.
function WaitlistForm({ onSecretActivate }: { onSecretActivate: () => void }) {
  const t = useTranslations('comingSoon')
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'saving' | 'done' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressFired = useRef(false)

  const WHATSAPP_URL = 'https://wa.me/85261808022'

  async function submit() {
    const trimmedValue = email.trim()

    // If the value doesn't contain @, try it as a gate password
    if (!trimmedValue.includes('@')) {
      setError(null)
      setStatus('saving')
      try {
        const res = await fetch('/api/gate/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: trimmedValue }),
        })
        if (res.ok) {
          window.location.href = '/'
          return
        }
        // On failure, show the email error (don't reveal we tried a password)
        setStatus('error')
        setError(t('err_email'))
      } catch {
        setStatus('error')
        setError(t('err_email'))
      }
      return
    }

    // Looks like an email, proceed with normal validation and waitlist
    if (!isValidEmail(trimmedValue)) {
      setError(t('err_email'))
      return
    }
    setError(null)
    setStatus('saving')
    try {
      const res = await fetch('/api/gate/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedValue }),
      })
      if (!res.ok && res.status !== 429) throw new Error('failed')
      setStatus('done')
    } catch {
      setStatus('error')
      setError(t('err_generic'))
    }
  }

  function startPress() {
    longPressFired.current = false
    pressTimer.current = setTimeout(() => {
      longPressFired.current = true
      onSecretActivate()
    }, LONG_PRESS_MS)
  }

  function cancelPress() {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current)
      pressTimer.current = null
    }
  }

  function endPress() {
    cancelPress()
    if (!longPressFired.current) submit()
  }

  if (status === 'done') {
    return (
      <p data-cms-key="comingSoon.subscribed" style={{ color: GREEN, fontSize: 15, textAlign: 'center' }}>
        {t('subscribed')}
      </p>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={t('email_placeholder')}
        data-cms-key="comingSoon.email_placeholder"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        style={{
          height: 52,
          padding: '0 16px',
          borderRadius: 12,
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.1)',
          color: '#fff',
          fontSize: 16,
          outline: 'none',
        }}
      />
      {error && (
        <p role="alert" style={{ color: '#f87171', fontSize: 13 }}>
          {error}
        </p>
      )}
      <button
        type="button"
        disabled={status === 'saving'}
        data-cms-key="comingSoon.notify_me"
        onMouseDown={startPress}
        onMouseUp={endPress}
        onMouseLeave={cancelPress}
        onTouchStart={startPress}
        onTouchEnd={endPress}
        onTouchCancel={cancelPress}
        onContextMenu={(e) => e.preventDefault()}
        style={{
          height: 52,
          borderRadius: 9999,
          background: GREEN,
          color: '#000',
          fontWeight: 700,
          fontSize: 16,
          border: 'none',
          cursor: status === 'saving' ? 'not-allowed' : 'pointer',
          opacity: status === 'saving' ? 0.6 : 1,
          WebkitTouchCallout: 'none',
          WebkitUserSelect: 'none',
          userSelect: 'none',
        }}
      >
        {t('notify_me')}
      </button>
      <p
        data-cms-key="comingSoon.waitlist_remove"
        style={{
          fontSize: 12,
          color: '#A1A1A6',
          opacity: 0.8,
          textAlign: 'center',
          lineHeight: 1.5,
          margin: 0,
        }}
      >
        {t.rich('waitlist_remove', {
          email: (chunks) => (
            <a
              href="mailto:info@space8.com.hk"
              style={{
                color: '#A1A1A6',
                textDecoration: 'underline',
                transition: 'color 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = GREEN)}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#A1A1A6')}
              onFocus={(e) => (e.currentTarget.style.color = GREEN)}
              onBlur={(e) => (e.currentTarget.style.color = '#A1A1A6')}
            >
              {chunks}
            </a>
          ),
          whatsapp: (chunks) => (
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: '#A1A1A6',
                textDecoration: 'underline',
                transition: 'color 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = GREEN)}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#A1A1A6')}
              onFocus={(e) => (e.currentTarget.style.color = GREEN)}
              onBlur={(e) => (e.currentTarget.style.color = '#A1A1A6')}
            >
              {chunks}
            </a>
          ),
        })}
      </p>
    </div>
  )
}

function PasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations('comingSoon')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/gate/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (res.ok) {
        window.location.href = '/'
        return
      }
      setError(res.status === 429 ? t('err_generic') : t('err_password'))
    } catch {
      setError(t('err_generic'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="glass-panel"
            style={{ padding: 32, maxWidth: 360, width: '100%', position: 'relative' }}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              style={{ position: 'absolute', top: 16, right: 16, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <X size={20} color="#86868B" />
            </button>
            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
              <PasswordInput
                value={password}
                onChange={(e) => setPassword(e.target.value.trim())}
                placeholder={t('password_placeholder')}
                autoFocus
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                enterKeyHint="go"
                style={{
                  height: 52,
                  padding: '0 16px',
                  borderRadius: 12,
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#fff',
                  fontSize: 16,
                  outline: 'none',
                }}
              />
              {error && (
                <p role="alert" style={{ color: '#f87171', fontSize: 13 }}>
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={loading || !password}
                style={{
                  height: 52,
                  borderRadius: 9999,
                  background: GREEN,
                  color: '#000',
                  fontWeight: 700,
                  fontSize: 16,
                  border: 'none',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading || !password ? 0.6 : 1,
                }}
              >
                {loading ? t('unlocking') : t('unlock')}
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default function ComingSoonContent({ reason = 'prelaunch' }: { reason?: GateReason }) {
  const t = useTranslations('comingSoon')
  const [modalOpen, setModalOpen] = useState(false)

  const isMaintenanceMode = reason === 'maintenance'

  return (
    <main
      style={{
        position: 'relative',
        isolation: 'isolate',
        minHeight: '100vh',
        background: '#000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        overflow: 'hidden',
      }}
    >
      <Starfield />
      <AmbientGlow variant="gemini" />
      <section className="glass-panel" style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 440, padding: 40 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <Logo variant="full" theme="dark" size={48} />
          </div>
          <h1
            data-cms-key="comingSoon.title"
            style={{
              fontFamily: 'var(--font-noto-sans-tc), "Noto Sans TC", sans-serif',
              fontSize: 32,
              fontWeight: 700,
              letterSpacing: '-0.01em',
              color: '#fff',
              marginBottom: 12,
              lineHeight: 1.2,
            }}
          >
            {isMaintenanceMode ? '網站維護中' : t('title')}
          </h1>
          <p data-cms-key="comingSoon.subtitle" style={{ color: '#A1A1A6', fontSize: 15, lineHeight: 1.5 }}>
            {isMaintenanceMode
              ? '我們正在進行系統更新，請稍後再試。已授權用戶可正常訪問。'
              : t('subtitle')}
          </p>
        </div>
        {!isMaintenanceMode && <Countdown />}
        {!isMaintenanceMode && <WaitlistForm onSecretActivate={() => setModalOpen(true)} />}
      </section>
      <PasswordModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </main>
  )
}
