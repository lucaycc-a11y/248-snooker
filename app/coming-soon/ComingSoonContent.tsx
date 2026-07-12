'use client'

import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { Starfield } from '@/app/[locale]/Starfield'

const GREEN = '#22c55e'
const TRIGGER_TAPS = 5
const TRIGGER_WINDOW_MS = 2500

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function WaitlistForm() {
  const t = useTranslations('comingSoon')
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'saving' | 'done' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
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

  if (status === 'done') {
    return (
      <p data-cms-key="comingSoon.subscribed" style={{ color: GREEN, fontSize: 15, textAlign: 'center' }}>
        {t('subscribed')}
      </p>
    )
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
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
        type="submit"
        disabled={status === 'saving'}
        data-cms-key="comingSoon.notify_me"
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
        }}
      >
        {t('notify_me')}
      </button>
    </form>
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

// Hidden trigger: TRIGGER_TAPS taps on this near-invisible dot within
// TRIGGER_WINDOW_MS opens the password modal. Purely a UX deterrent (per the
// brief this is "psychological, not security" — the same origin's real gate
// enforcement is the middleware + hashed password check server-side).
function HiddenTrigger({ onActivate }: { onActivate: () => void }) {
  const tapsRef = useRef<number[]>([])

  function handleTap() {
    const now = Date.now()
    tapsRef.current = [...tapsRef.current, now].filter((t) => now - t < TRIGGER_WINDOW_MS)
    if (tapsRef.current.length >= TRIGGER_TAPS) {
      tapsRef.current = []
      onActivate()
    }
  }

  return (
    <button
      type="button"
      onClick={handleTap}
      aria-hidden="true"
      tabIndex={-1}
      style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        width: 44,
        height: 44,
        borderRadius: '50%',
        background: 'transparent',
        border: 'none',
        cursor: 'default',
        opacity: 0.03,
        zIndex: 40,
      }}
    />
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
      <section className="glass-panel" style={{ position: 'relative', width: '100%', maxWidth: 440, padding: 40 }}>
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
        <WaitlistForm />
      </section>
      <HiddenTrigger onActivate={() => setModalOpen(true)} />
      <PasswordModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </main>
  )
}
