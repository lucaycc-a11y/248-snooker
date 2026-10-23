'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'

// "New members from HK$X" copy — PREVIEW ONLY.
// Renders nothing for everyone except an active super_admin: the data comes from
// /api/internal/new-member-offer, which 404s for all other visitors. Nothing is
// in the server HTML, so crawlers and regular members never see it. Public
// release = remove the gate here and add the same copy to metadata / JSON-LD.

type Offer = {
  floorPrice: number
  basePrice: number
  promoCode: string | null
  promoDiscount: number
  creditAmount: number
}

let cache: Promise<Offer | null> | null = null

function loadOffer(): Promise<Offer | null> {
  if (!cache) {
    cache = fetch('/api/internal/new-member-offer', { credentials: 'same-origin' })
      .then(async (res) => (res.ok ? ((await res.json()) as Offer) : null))
      .catch(() => null)
  }
  return cache
}

type Props = {
  variant?: 'banner' | 'inline' | 'faq'
  theme?: 'dark' | 'light'
}

export default function NewMemberOfferNote({ variant = 'banner', theme = 'dark' }: Props) {
  const t = useTranslations('newMemberOffer')
  const [offer, setOffer] = useState<Offer | null>(null)

  useEffect(() => {
    let alive = true
    loadOffer().then((o) => {
      if (alive) setOffer(o)
    })
    return () => {
      alive = false
    }
  }, [])

  if (!offer) return null

  const dark = theme === 'dark'
  const ink = dark ? '#fff' : '#1D1D1F'
  const muted = dark ? 'rgba(255,255,255,0.65)' : '#6E6E73'
  const params = {
    price: offer.floorPrice,
    base: offer.basePrice,
    code: offer.promoCode ?? '',
    promo: offer.promoDiscount,
    credit: offer.creditAmount,
  }

  const badge = (
    <span
      style={{
        display: 'inline-block',
        fontSize: 11,
        letterSpacing: '0.04em',
        padding: '2px 8px',
        borderRadius: 999,
        border: '1px dashed #22c55e',
        color: '#22c55e',
        marginBottom: 8,
      }}
    >
      {t('preview_badge')}
    </span>
  )

  if (variant === 'faq') {
    return (
      <div style={{ padding: '20px 0', borderTop: `1px dashed ${dark ? 'rgba(255,255,255,0.2)' : '#D2D2D7'}` }}>
        {badge}
        <h3 data-cms-key="newMemberOffer.faq_q" style={{ color: ink, fontSize: 17, fontWeight: 600, margin: '0 0 8px' }}>
          {t('faq_q')}
        </h3>
        <p data-cms-key="newMemberOffer.faq_a" style={{ color: muted, fontSize: 15, lineHeight: 1.65, margin: 0 }}>
          {t('faq_a', params)}
        </p>
      </div>
    )
  }

  return (
    <div
      style={{
        margin: '16px auto',
        maxWidth: 720,
        padding: variant === 'inline' ? '10px 16px' : '16px 20px',
        textAlign: 'center',
        borderRadius: 16,
        border: '1px dashed rgba(34,197,94,0.6)',
        background: dark ? 'rgba(34,197,94,0.06)' : 'rgba(34,197,94,0.08)',
      }}
    >
      {badge}
      <p data-cms-key="newMemberOffer.line" style={{ color: ink, fontSize: variant === 'inline' ? 15 : 18, fontWeight: 600, margin: 0 }}>
        {t('line', params)}
      </p>
      {variant === 'banner' && (
        <p data-cms-key="newMemberOffer.detail" style={{ color: muted, fontSize: 13, lineHeight: 1.6, margin: '6px 0 0' }}>
          {t('detail', params)}
        </p>
      )}
    </div>
  )
}
