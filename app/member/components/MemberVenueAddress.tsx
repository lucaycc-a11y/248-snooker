'use client'

import { useLocale } from 'next-intl'
import { ADDRESS, MAPS_URL } from '@/lib/site/nap'
import { useV802 } from '@/lib/feature/use-v802'

// Full venue address incl. floor/unit. Shown ONLY here (logged-in member page,
// below the member card) and in the booking confirmation email — public pages
// show the area line only. The website uses one dark map (with unit); the
// confirmation email keeps its three step photos.

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
      <a href={MAPS_URL} target="_blank" rel="noopener noreferrer" style={{ display: 'block', marginTop: 16 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/venue/s8-map-dark.webp"
          alt={en ? 'Map to SPACE8: main entrance, side entrance, Unit 05, 3/F' : 'SPACE8 地圖：大廈正門、側門、3 樓 05 室'}
          loading="lazy"
          width={1200}
          height={861}
          style={{ display: 'block', width: '100%', height: 'auto', borderRadius: 12 }}
        />
      </a>
    </section>
  )
}
