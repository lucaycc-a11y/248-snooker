'use client'

import { useLocale } from 'next-intl'
import { ADDRESS, MAPS_URL } from '@/lib/site/nap'
import { useV802 } from '@/lib/feature/use-v802'

// Full venue address incl. floor/unit. Shown ONLY here (logged-in member page,
// below the member card) and in the booking confirmation email — public pages
// show the area line only.
const STEPS = [
  {
    img: 'main-entrance',
    titleZh: '1. 大廈正門',
    titleEn: '1. Main Entrance',
    bodyZh: '從大有街 32 號入口進入。',
    bodyEn: 'Enter from 32 Tai Yau Street.',
  },
  {
    img: 'side-entrance',
    titleZh: '2. 貨車入口',
    titleEn: '2. Side Entrance',
    bodyZh: '如有需要，可由側面入口進入。',
    bodyEn: 'Use the side entrance if needed.',
  },
  {
    img: 'space8-door',
    titleZh: '3. SPACE8 門口',
    titleEn: '3. SPACE8 Entrance',
    bodyZh: '3 樓 05 室，用會員 QR Code 開門。',
    bodyEn: 'Unit 05, 3/F. Scan your member QR code to open the door.',
  },
] as const

export function MemberVenueAddress({ className }: { className?: string }) {
  const locale = useLocale()
  const en = locale === 'en'
  const v802 = useV802() // admin-only while 8.0.2 is a test build
  if (!v802) return null
  return (
    <section
      data-testid="member-venue-address"
      className={className}
      style={{
        marginTop: 16,
        padding: '14px 16px',
        borderRadius: 16,
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.1)',
        color: '#fff',
      }}
    >
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 6 }}>
        {en ? 'Venue address' : '場地地址'}
      </div>
      <div style={{ fontSize: 14, lineHeight: 1.5 }}>{en ? ADDRESS.venuePageEn : ADDRESS.venuePageZh}</div>
      <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.3, margin: '2px 0 6px' }}>
        {en ? ADDRESS.unitEn : ADDRESS.unitZh}
      </div>
      <a
        href={MAPS_URL}
        target="_blank"
        rel="noopener noreferrer"
        style={{ fontSize: 13, color: '#3DDC84', textDecoration: 'none' }}
      >
        {en ? 'Open in Google Maps →' : '在 Google Maps 打開 →'}
      </a>
      <div style={{ marginTop: 16, display: 'grid', gap: 16 }}>
        {STEPS.map((step) => (
          <figure key={step.img} style={{ margin: 0 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/images/venue-entrance/${step.img}.jpg`}
              alt={en ? step.titleEn : step.titleZh}
              loading="lazy"
              style={{ display: 'block', width: '100%', height: 'auto', borderRadius: 12 }}
            />
            <figcaption style={{ marginTop: 6, fontSize: 13, lineHeight: 1.5 }}>
              <strong>{en ? step.titleEn : step.titleZh}</strong>
              <br />
              <span style={{ color: 'rgba(255,255,255,0.7)' }}>{en ? step.bodyEn : step.bodyZh}</span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  )
}
