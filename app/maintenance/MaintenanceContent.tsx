'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Wrench, Clock, Mail, CheckCircle2 } from 'lucide-react'
import { Starfield } from '@/app/[locale]/Starfield'
import { AmbientGlow } from '@/components/shared/AmbientGlow'
import { Logo } from '@/components/brand/Logo'

const GREEN = '#22c55e'

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function NotifyForm() {
  const t = useTranslations('maintenance')
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
        body: JSON.stringify({ email, source: 'maintenance' }),
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', background: 'rgba(34, 197, 94, 0.1)', border: `1px solid ${GREEN}`, borderRadius: 12 }}>
        <CheckCircle2 size={20} color={GREEN} />
        <p data-cms-key="maintenance.subscribed" style={{ color: GREEN, fontSize: 15, margin: 0 }}>
          {t('subscribed')}
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('email_placeholder')}
          data-cms-key="maintenance.email_placeholder"
          style={{
            flex: '1 1 200px',
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
        <button
          type="submit"
          disabled={status === 'saving'}
          data-cms-key="maintenance.notify_me"
          style={{
            flex: '0 0 auto',
            minWidth: 140,
            height: 52,
            padding: '0 24px',
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
          {status === 'saving' ? t('sending') : t('notify_me')}
        </button>
      </div>
      {error && (
        <p role="alert" style={{ color: '#f87171', fontSize: 13, margin: 0 }}>
          {error}
        </p>
      )}
    </form>
  )
}

export default function MaintenanceContent() {
  const t = useTranslations('maintenance')

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
      <section className="glass-panel" style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 540, padding: 40 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <Logo variant="full" theme="dark" size={48} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 16 }}>
            <Wrench size={28} color={GREEN} />
            <h1
              data-cms-key="maintenance.title"
              style={{ fontFamily: '"Bebas Neue", sans-serif', fontSize: 40, letterSpacing: '0.02em', color: '#fff', margin: 0 }}
            >
              {t('title')}
            </h1>
          </div>
          <p data-cms-key="maintenance.subtitle" style={{ color: '#A1A1A6', fontSize: 15, lineHeight: 1.6, marginBottom: 24 }}>
            {t('subtitle')}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 20px', background: 'rgba(255,255,255,0.04)', borderRadius: 12, marginBottom: 8 }}>
            <Clock size={18} color="#A1A1A6" />
            <span data-cms-key="maintenance.eta" style={{ fontSize: 14, color: '#A1A1A6' }}>
              {t('eta')}
            </span>
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Mail size={18} color="#fff" />
            <h2 data-cms-key="maintenance.notify_title" style={{ fontSize: 16, fontWeight: 600, color: '#fff', margin: 0 }}>
              {t('notify_title')}
            </h2>
          </div>
          <p data-cms-key="maintenance.notify_desc" style={{ fontSize: 14, color: '#A1A1A6', marginBottom: 16, lineHeight: 1.5 }}>
            {t('notify_desc')}
          </p>
          <NotifyForm />
        </div>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 20 }}>
          <p data-cms-key="maintenance.contact" style={{ fontSize: 13, color: '#86868B', textAlign: 'center', margin: 0, lineHeight: 1.6 }}>
            {t('contact')}
          </p>
        </div>
      </section>
    </main>
  )
}
