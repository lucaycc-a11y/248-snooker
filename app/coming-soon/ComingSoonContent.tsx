'use client'

import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { Starfield } from '@/app/[locale]/Starfield'
import { AmbientGlow } from '@/components/shared/AmbientGlow'

const GREEN = '#22c55e'
const LONG_PRESS_MS = 2500

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
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

  async function submit() {
    if (!isValidEmail(email)) {
      setError(t('err_email'))
      return
    }
    setError(null)
    setStatus('saving')
    try {
      const res = await fetch('/api/gate/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
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
              style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <X size={20} color="#86868B" />
            </button>
            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('password_placeholder')}
                autoFocus
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

export default function ComingSoonContent() {
  const t = useTranslations('comingSoon')
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <main
      style={{
        position: 'relative',
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
      <AmbientGlow />
      <section className="glass-panel" style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 440, padding: 40 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div
            data-cms-key="comingSoon.brand"
            style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.32em', color: GREEN, marginBottom: 12 }}
          >
            {t('brand')}
          </div>
          <h1
            data-cms-key="comingSoon.title"
            style={{ fontFamily: '"Bebas Neue", sans-serif', fontSize: 40, letterSpacing: '0.02em', color: '#fff', marginBottom: 12 }}
          >
            {t('title')}
          </h1>
          <p data-cms-key="comingSoon.subtitle" style={{ color: '#86868B', fontSize: 15, lineHeight: 1.5 }}>
            {t('subtitle')}
          </p>
        </div>
        <WaitlistForm onSecretActivate={() => setModalOpen(true)} />
      </section>
      <PasswordModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </main>
  )
}
