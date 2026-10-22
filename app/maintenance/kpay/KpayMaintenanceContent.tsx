'use client'

import { useTranslations } from 'next-intl'
import { Clock, Mail, MousePointerClick, ShieldCheck, Zap } from 'lucide-react'
import { Starfield } from '@/app/[locale]/Starfield'
import { AmbientGlow } from '@/components/shared/AmbientGlow'
import { Logo } from '@/components/brand/Logo'
import { NotifyForm } from '../MaintenanceContent'

const GREEN = '#22c55e'

type Feature = { key: 'f1' | 'f2' | 'f3'; icon: typeof Zap }
const FEATURES: readonly Feature[] = [
  { key: 'f1', icon: MousePointerClick },
  { key: 'f2', icon: Zap },
  { key: 'f3', icon: ShieldCheck },
]

export default function KpayMaintenanceContent() {
  const t = useTranslations('maintenanceKpay')
  const tm = useTranslations('maintenance')

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
        padding: '48px 16px',
        overflow: 'hidden',
      }}
    >
      <Starfield />
      <AmbientGlow variant="gemini" />
      <section className="glass-panel" style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 560, padding: '48px 40px' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
            <Logo variant="full" theme="dark" size={40} />
          </div>
          <p
            data-cms-key="maintenanceKpay.eyebrow"
            style={{ color: GREEN, fontSize: 14, fontWeight: 600, letterSpacing: '0.08em', margin: '0 0 12px' }}
          >
            {t('eyebrow')}
          </p>
          <h1
            data-cms-key="maintenanceKpay.title"
            style={{ color: '#fff', fontSize: 'clamp(32px, 7vw, 44px)', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.15, margin: '0 0 16px' }}
          >
            {t('title')}
          </h1>
          <p
            data-cms-key="maintenanceKpay.subtitle"
            style={{ color: '#A1A1A6', fontSize: 17, lineHeight: 1.6, margin: 0 }}
          >
            {t('subtitle')}
          </p>
        </div>

        <ul style={{ listStyle: 'none', margin: '0 0 32px', padding: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {FEATURES.map(({ key, icon: Icon }) => (
            <li key={key} style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              <span
                style={{
                  flex: '0 0 40px',
                  height: 40,
                  borderRadius: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(34, 197, 94, 0.12)',
                }}
              >
                <Icon size={20} color={GREEN} />
              </span>
              <div>
                <h2
                  data-cms-key={`maintenanceKpay.${key}_title`}
                  style={{ color: '#fff', fontSize: 16, fontWeight: 600, margin: '0 0 4px' }}
                >
                  {t(`${key}_title`)}
                </h2>
                <p
                  data-cms-key={`maintenanceKpay.${key}_desc`}
                  style={{ color: '#A1A1A6', fontSize: 14, lineHeight: 1.55, margin: 0 }}
                >
                  {t(`${key}_desc`)}
                </p>
              </div>
            </li>
          ))}
        </ul>

        <div
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 20px', background: 'rgba(255,255,255,0.04)', borderRadius: 12, marginBottom: 32 }}
        >
          <Clock size={18} color="#A1A1A6" />
          <span data-cms-key="maintenanceKpay.eta" style={{ fontSize: 14, color: '#A1A1A6' }}>
            {t('eta')}
          </span>
        </div>

        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Mail size={18} color="#fff" />
            <h2 data-cms-key="maintenanceKpay.notify_title" style={{ fontSize: 16, fontWeight: 600, color: '#fff', margin: 0 }}>
              {t('notify_title')}
            </h2>
          </div>
          <p data-cms-key="maintenanceKpay.notify_desc" style={{ fontSize: 14, color: '#A1A1A6', marginBottom: 16, lineHeight: 1.5 }}>
            {t('notify_desc')}
          </p>
          <NotifyForm />
        </div>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 20 }}>
          <p data-cms-key="maintenance.contact" style={{ fontSize: 13, color: '#86868B', textAlign: 'center', margin: 0, lineHeight: 1.6 }}>
            {tm('contact')}
          </p>
        </div>
      </section>
    </main>
  )
}
