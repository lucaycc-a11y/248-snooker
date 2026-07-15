'use client'

import dynamic from 'next/dynamic'
import { Link } from '@/i18n/navigation'
import { Instagram, MessageCircle, MapPin, Clock } from 'lucide-react'
import { tokens } from '@/app/styles/tokens'
import { useTranslations } from 'next-intl'
import { Logo } from '@/components/brand'

const WHATSAPP_URL = 'https://wa.me/85264274620'
const INSTAGRAM_URL = 'https://instagram.com/248snooker'
const MAP_QUERY = '泰力工業中心 32 Tai Yau Street, San Po Kong, Hong Kong'
const MAPS_URL = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(MAP_QUERY)}`

// Free CARTO Dark Matter tile map — no API key, no billing account needed
// (replaces the old Google Maps Static API thumbnail). Leaflet touches
// `window` at import time, so it must be loaded client-only.
const FooterMap = dynamic(
  () => import('./FooterMap').then((mod) => mod.FooterMap),
  {
    ssr: false,
    loading: () => (
      <div
        style={{
          width: '100%',
          maxWidth: '320px',
          aspectRatio: '2 / 1',
          borderRadius: '14px',
          border: `1px solid ${tokens.colors.border}`,
          background: tokens.colors.surface,
          marginBottom: '14px',
        }}
      />
    ),
  },
)

export default function Footer() {
  const t = useTranslations()

  const navLinks: { label: string; href: string }[] = [
    { label: t('nav.book'), href: '/book' },
    { label: t('nav.venue'), href: '/venue' },
    { label: t('nav.about'), href: '/about' },
    { label: t('nav.blog'), href: '/blog' },
    { label: t('nav.membership'), href: '/membership' },
    { label: t('footer.legal'), href: '/legal' },
    { label: t('footer.privacy'), href: '/privacy' },
  ]
  return (
    <footer
      data-nav-theme="dark"
      className="px-6 py-12 md:px-8"
      style={{
        backgroundColor: tokens.colors.bg,
        borderTop: `1px solid ${tokens.colors.border}`,
      }}
    >
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        {/* Top — SVG logo + social icons */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
          }}
        >
          <Logo variant="full" theme="dark" size={39} />

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="WhatsApp"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                color: tokens.colors.textMuted,
              }}
            >
              <MessageCircle size={22} strokeWidth={1.75} />
            </a>
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                color: tokens.colors.textMuted,
              }}
            >
              <Instagram size={22} strokeWidth={1.75} />
            </a>
          </div>
        </div>

        {/* Contact — address + directions on every page */}
        <div
          style={{
            marginTop: '32px',
            paddingTop: '28px',
            borderTop: `1px solid ${tokens.colors.border}`,
            display: 'flex',
            flexWrap: 'wrap',
            gap: '20px 48px',
          }}
        >
          <div style={{ minWidth: '260px', flex: '1 1 320px' }}>
            <div
              data-cms-key="footer.contact_title"
              style={{
                fontSize: '13px',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: tokens.colors.textMuted,
                marginBottom: '12px',
              }}
            >
              {t('footer.contact_title')}
            </div>
            {/* Dark map thumbnail — CARTO Dark Matter tiles (free, no API
                key/billing). Links out to Google Maps like the text link
                below, same as the old Google Static Maps image did. */}
            <FooterMap mapsUrl={MAPS_URL} ariaLabel={t('footer.map_cta')} />
            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '10px' }}>
              <MapPin size={16} strokeWidth={1.75} style={{ color: tokens.colors.textMuted, flexShrink: 0, marginTop: 2 }} />
              <div>
                <div data-cms-key="footer.address" style={{ fontSize: '14px', color: tokens.colors.text, lineHeight: 1.6 }}>
                  {t('footer.address')}
                </div>
                <div data-cms-key="footer.directions" style={{ fontSize: '13px', color: tokens.colors.textMuted, marginTop: 4, lineHeight: 1.6 }}>
                  {t('footer.directions')}
                </div>
                <a
                  href={MAPS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-cms-key="footer.map_cta"
                  style={{
                    display: 'inline-block',
                    marginTop: 8,
                    fontSize: '13px',
                    color: tokens.colors.link,
                    textDecoration: 'underline',
                    textUnderlineOffset: '3px',
                  }}
                >
                  {t('footer.map_cta')}
                </a>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <Clock size={16} strokeWidth={1.75} style={{ color: tokens.colors.textMuted, flexShrink: 0 }} />
              <span data-cms-key="footer.hours" style={{ fontSize: '13px', color: tokens.colors.textMuted }}>
                {t('footer.hours')}
              </span>
            </div>
          </div>
        </div>

        {/* Middle — nav links, single centred row */}
        <nav
          style={{
            marginTop: '32px',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px 16px',
          }}
        >
          {navLinks.map((link, i) => (
            <span
              key={link.href}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '16px' }}
            >
              <Link
                href={link.href}
                style={{
                  fontSize: '14px',
                  color: tokens.colors.textMuted,
                  textDecoration: 'none',
                }}
              >
                {link.label}
              </Link>
              {i < navLinks.length - 1 && (
                <span style={{ color: tokens.colors.textFaint, fontSize: '13px' }}>·</span>
              )}
            </span>
          ))}
        </nav>

        {/* Bottom — single centred line */}
        <p
          style={{
            marginTop: '32px',
            textAlign: 'center',
            fontSize: '13px',
            color: tokens.colors.textFaint,
          }}
        >
          &copy; 2026 Space8 · {t('footer.tagline')}
        </p>
      </div>
    </footer>
  )
}
