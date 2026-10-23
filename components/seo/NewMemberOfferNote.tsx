'use client'

import { useEffect, useState } from 'react'
import { useLocale } from 'next-intl'

// "New members from HK$X" copy — PREVIEW ONLY.
// Renders nothing for everyone except an active super_admin: the data comes from
// /api/internal/new-member-offer, which 404s for all other visitors. Nothing is
// in the server HTML, so crawlers and regular members never see it. Public
// release = remove the gate here and add the same copy to metadata / JSON-LD.

// The copy itself comes from the API response (never from messages/*.json, which
// every browser downloads), so non-admins never receive the strings at all.
type Text = { preview_badge: string; line: string; detail: string; faq_q: string; faq_a: string }

const cache = new Map<string, Promise<Text | null>>()

function loadText(locale: string): Promise<Text | null> {
  let hit = cache.get(locale)
  if (!hit) {
    hit = fetch(`/api/internal/new-member-offer?locale=${encodeURIComponent(locale)}`, { credentials: 'same-origin' })
      .then(async (res) => (res.ok ? (((await res.json()) as { text: Text }).text) : null))
      .catch(() => null)
    cache.set(locale, hit)
  }
  return hit
}

type Props = {
  variant?: 'banner' | 'inline' | 'faq'
  theme?: 'dark' | 'light'
}

export default function NewMemberOfferNote({ variant = 'banner', theme = 'dark' }: Props) {
  const locale = useLocale()
  const [t, setT] = useState<Text | null>(null)

  useEffect(() => {
    let alive = true
    loadText(locale).then((o) => {
      if (alive) setT(o)
    })
    return () => {
      alive = false
    }
  }, [locale])

  if (!t) return null

  const dark = theme === 'dark'
  const ink = dark ? '#fff' : '#1D1D1F'
  const muted = dark ? 'rgba(255,255,255,0.65)' : '#6E6E73'

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
      {t.preview_badge}
    </span>
  )

  if (variant === 'faq') {
    return (
      <div style={{ padding: '20px 0', borderTop: `1px dashed ${dark ? 'rgba(255,255,255,0.2)' : '#D2D2D7'}` }}>
        {badge}
        <h3 data-cms-key="newMemberOffer.faq_q" style={{ color: ink, fontSize: 17, fontWeight: 600, margin: '0 0 8px' }}>
          {t.faq_q}
        </h3>
        <p data-cms-key="newMemberOffer.faq_a" style={{ color: muted, fontSize: 15, lineHeight: 1.65, margin: 0 }}>
          {t.faq_a}
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
        {t.line}
      </p>
      {variant === 'banner' && (
        <p data-cms-key="newMemberOffer.detail" style={{ color: muted, fontSize: 13, lineHeight: 1.6, margin: '6px 0 0' }}>
          {t.detail}
        </p>
      )}
    </div>
  )
}
