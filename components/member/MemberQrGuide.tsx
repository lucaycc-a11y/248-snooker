'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  BarChart3,
  DoorOpen,
  Lightbulb,
  LockKeyhole,
  ScanLine,
  ShieldCheck,
  Smartphone,
  Sparkles,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { QRCode } from '@/components/shared/QRCode'

const GREEN = '#22C55E'
const INK = '#F5F5F7'
const SUBTLE = '#A1A1A6'
const BORDER = 'rgba(255,255,255,0.12)'
const SURFACE = 'rgba(255,255,255,0.045)'
const FONT_FAMILY = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Helvetica, Arial, sans-serif"
const EASE = [0.16, 1, 0.3, 1] as const

const FEATURE_ICONS = [DoorOpen, LockKeyhole, Sparkles, BarChart3] as const
const STEP_ICONS = [Smartphone, ScanLine, ShieldCheck] as const

export default function MemberQrGuide({
  memberCode,
  qrDataUrl,
}: {
  memberCode: string
  qrDataUrl: string | null
}) {
  const t = useTranslations('memberPage')
  const featureKeys = ['entry', 'locker', 'pilot', 'records'] as const
  const tipKeys = ['brightness', 'private', 'offline', 'display'] as const

  return (
    <div style={{ color: INK, fontFamily: FONT_FAMILY }}>
      <section
        aria-labelledby="member-access-title"
        style={{
          border: `1px solid ${BORDER}`,
          borderRadius: 24,
          background: 'linear-gradient(145deg, rgba(34,197,94,0.12), rgba(255,255,255,0.035) 45%, rgba(0,0,0,0.18))',
          padding: 'clamp(24px, 5vw, 48px)',
          overflow: 'hidden',
        }}
      >
        <div style={{ maxWidth: 680 }}>
          <div className="font-label" style={{ color: GREEN, fontSize: 12, fontWeight: 700 }}>
            {t('access_eyebrow')}
          </div>
          <motion.h1
            id="member-access-title"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: EASE }}
            style={{ fontSize: 'clamp(34px, 7vw, 64px)', lineHeight: 0.98, letterSpacing: '-0.04em', margin: '14px 0 18px', fontWeight: 700 }}
          >
            {t('access_title')}
          </motion.h1>
          <p style={{ color: SUBTLE, lineHeight: 1.75, fontSize: 16, margin: 0, maxWidth: 620 }}>
            {t('access_intro')}
          </p>
        </div>
      </section>

      <section aria-labelledby="member-qr-title" style={{ marginTop: 20, border: `1px solid ${BORDER}`, borderRadius: 24, background: '#FDFCF8', color: '#0A0A0A', padding: 'clamp(24px, 6vw, 48px)', textAlign: 'center' }}>
        <div className="font-label" style={{ color: '#5F6368', fontSize: 12, fontWeight: 700 }}>{t('access_qr_label')}</div>
        <h2 id="member-qr-title" style={{ fontSize: 'clamp(24px, 5vw, 36px)', lineHeight: 1.1, margin: '12px 0 8px', letterSpacing: '-0.03em' }}>{t('access_qr_title')}</h2>
        <p style={{ color: '#5F6368', margin: '0 auto 24px', maxWidth: 520, lineHeight: 1.65 }}>{t('access_qr_description')}</p>
        <div style={{ position: 'relative', display: 'inline-flex', padding: 18, border: '1px solid rgba(0,0,0,0.12)', borderRadius: 18, background: '#fff' }}>
          <QRCode src={qrDataUrl} size={Math.min(280, 68 * 4)} enlargeLabel={t('access_qr_enlarge')} closeLabel={t('close')} />
          <span aria-hidden="true" className="member-qr-scanline" />
        </div>
        <div style={{ marginTop: 18, color: '#5F6368', fontSize: 13 }}>
          {t('access_qr_identity')}
          <div className="font-code" style={{ marginTop: 8, color: '#0A0A0A', fontWeight: 700, overflowWrap: 'anywhere' }}>{memberCode}</div>
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 250px), 1fr))', gap: 12, marginTop: 20 }}>
        {featureKeys.map((key, index) => {
          const Icon = FEATURE_ICONS[index]
          return (
            <motion.article key={key} whileHover={{ y: -3 }} transition={{ duration: 0.2, ease: EASE }} style={{ border: `1px solid ${BORDER}`, borderRadius: 18, background: SURFACE, padding: 22 }}>
              <Icon aria-hidden="true" size={24} color={GREEN} strokeWidth={1.7} />
              <div style={{ color: GREEN, marginTop: 18, fontSize: 12, fontWeight: 700, letterSpacing: '0.1em' }}>{t(`access_feature_${key}_label`)}</div>
              <h3 style={{ margin: '8px 0 8px', fontSize: 20, lineHeight: 1.2 }}>{t(`access_feature_${key}_title`)}</h3>
              <p style={{ color: SUBTLE, lineHeight: 1.7, fontSize: 14, margin: 0 }}>{t(`access_feature_${key}_body`)}</p>
            </motion.article>
          )
        })}
      </div>

      <section style={{ marginTop: 32 }} aria-labelledby="member-qr-steps-title">
        <h2 id="member-qr-steps-title" style={{ fontSize: 26, margin: 0 }}>{t('access_steps_title')}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: 12, marginTop: 14 }}>
          {STEP_ICONS.map((Icon, index) => (
            <div key={index} style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 18 }}>
              <Icon aria-hidden="true" size={20} color={GREEN} strokeWidth={1.7} />
              <div style={{ color: GREEN, fontSize: 12, fontWeight: 700, marginTop: 14 }}>{String(index + 1).padStart(2, '0')}</div>
              <h3 style={{ fontSize: 17, margin: '6px 0 6px' }}>{t(`access_step_${index + 1}_title`)}</h3>
              <p style={{ color: SUBTLE, lineHeight: 1.65, fontSize: 14, margin: 0 }}>{t(`access_step_${index + 1}_body`)}</p>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginTop: 32, border: `1px solid ${BORDER}`, borderRadius: 18, padding: 22, background: SURFACE }} aria-labelledby="member-qr-tips-title">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Lightbulb aria-hidden="true" size={20} color={GREEN} /><h2 id="member-qr-tips-title" style={{ fontSize: 21, margin: 0 }}>{t('access_tips_title')}</h2></div>
        <ul style={{ color: SUBTLE, display: 'grid', gap: 10, lineHeight: 1.6, margin: '18px 0 0', paddingLeft: 20 }}>
          {tipKeys.map((key) => <li key={key}>{t(`access_tip_${key}`)}</li>)}
        </ul>
      </section>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 24 }}>
        <Link href="/member" style={{ minHeight: 48, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 999, padding: '12px 20px', background: GREEN, color: '#000', fontWeight: 700, textDecoration: 'none' }}>
          {t('access_cta_member')} <ArrowRight aria-hidden="true" size={17} />
        </Link>
        <Link href="/member?tab=bookings" style={{ minHeight: 48, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 999, padding: '12px 20px', border: `1px solid ${BORDER}`, color: INK, fontWeight: 600, textDecoration: 'none' }}>
          {t('access_cta_records')}
        </Link>
      </div>

      <footer style={{ color: SUBTLE, fontSize: 12, letterSpacing: '0.08em', marginTop: 34, textAlign: 'center' }}>{t('access_footer')}</footer>
    </div>
  )
}
