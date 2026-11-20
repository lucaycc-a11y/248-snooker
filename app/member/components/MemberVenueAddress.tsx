'use client'

import { useLocale } from 'next-intl'
import { ADDRESS, MAPS_URL } from '@/lib/site/nap'

// Full venue address incl. floor/unit. Shown ONLY here (logged-in member page,
// below the member card) and in the booking confirmation email — public pages
// show the area line only.
export function MemberVenueAddress() {
  const locale = useLocale()
  const en = locale === 'en'
  return (
    <section
      data-testid="member-venue-address"
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
    </section>
  )
}
