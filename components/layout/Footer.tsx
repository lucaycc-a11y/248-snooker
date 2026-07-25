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
    { label: t('nav.faq'), href: '/faq' },
    { label: t('footer.legal'), href: '/legal' },
    { label: t('footer.privacy'), href: '/privacy' },
  ]
  return (
    <footer
      data-nav-theme="dark"
      className="footer-root px-6 md:px-8"
      style={{
        backgroundColor: tokens.colors.bg,
        borderTop: `1px solid ${tokens.colors.border}`,
        // position:relative is the anchor for the absolute background layer
        // below; overflow:hidden clips the giant wordmark so it can never
        // bleed past the footer's own box onto another section.
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* ── Background layer: giant decorative "SPACE8" wordmark ──────────────
          DOM-first child, position:absolute inset:0, z-index:0 — a pure
          backdrop that sits *behind* every other footer element (all of which
          live in the z-index:1 content wrapper). Its own overflow:hidden +ol
          the footer's guarantees the artwork is always clipped to the footer
          box. Uses the official wordmark SVG (never CSS-simulated text, which
          drifts on kerning and overlaps other text layers). The mask fades the
          artwork toward the TOP so its faint edge — not its dense body — is
          what sits behind the copyright row, and the copyright row's own
          bottom padding keeps clear of the dense band entirely. */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          overflow: 'hidden',
          zIndex: 0,
          pointerEvents: 'none',
        }}
      >
        <img
          src="/logos/logo-white-horizontal.svg"
          alt=""
          style={{
            position: 'absolute',
            bottom: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            width: '92%',
            maxWidth: 1400,
            height: 'auto',
            opacity: 0.12,
            // Densest at the bottom edge, fading out toward the top so the
            // copyright/links sitting above it overlap only the faint tail.
            WebkitMaskImage: 'linear-gradient(to top, #000 0%, rgba(0,0,0,0.4) 45%, transparent 100%)',
            maskImage: 'linear-gradient(to top, #000 0%, rgba(0,0,0,0.4) 45%, transparent 100%)',
            userSelect: 'none',
          }}
        />
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', position: 'relative', zIndex: 1 }}>
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

        {/* Contact + SEO — same two-column layout as before */}
        <div
          style={{
            marginTop: '32px',
            paddingTop: '28px',
            borderTop: `1px solid ${tokens.colors.border}`,
            display: 'flex',
            flexWrap: 'wrap',
            gap: '32px 48px',
          }}
        >
          <section style={{ minWidth: '260px', flex: '1 1 320px' }}>
            <div
              data-cms-key="footer.contact_title"
              style={{
                fontSize: '13px',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: tokens.colors.textMuted,
                marginBottom: '16px',
              }}
            >
              {t('footer.contact_title')}
            </div>
            <div style={{ marginBottom: '20px' }}>
              <FooterMap mapsUrl={MAPS_URL} ariaLabel={t('footer.map_cta')} />
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '16px' }}>
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
                    display: 'inline-flex',
                    alignItems: 'center',
                    minHeight: 44,
                    marginTop: 2,
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
          </section>

          <section
            itemScope
            itemType="https://schema.org/LocalBusiness"
            style={{
              minWidth: '260px',
              flex: '1 1 320px',
              border: `1px solid ${tokens.colors.border}`,
              borderRadius: '14px',
              padding: '20px',
              alignSelf: 'flex-start',
            }}
          >
            <h2
              data-cms-key="footer.seo_title"
              itemProp="name"
              style={{
                fontSize: '13px',
                fontWeight: 400,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: tokens.colors.textMuted,
                margin: '0 0 12px',
              }}
            >
              {t('footer.seo_title')}
            </h2>
            <p
              data-cms-key="footer.seo_blurb"
              itemProp="description"
              style={{
                fontSize: '13px',
                color: tokens.colors.textMuted,
                lineHeight: 1.7,
                margin: 0,
                maxWidth: '46ch',
              }}
            >
              {t('footer.seo_blurb')}
            </p>
            <meta itemProp="address" content={t('footer.address')} />
            <meta itemProp="openingHours" content="Mo-Su 06:00-24:00" />
          </section>
        </div>

        {/* Nav links */}
        <nav className="footer-links">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href} className="footer-link">
              {link.label}
            </Link>
          ))}
        </nav>
        <style jsx>{`
          .footer-links {
            margin-top: 40px;
            padding-top: 28px;
            border-top: 1px solid ${tokens.colors.border};
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 4px 16px;
          }
          .footer-links :global(.footer-link) {
            display: inline-flex;
            align-items: center;
            min-height: 44px;
            font-size: 14px;
            color: ${tokens.colors.textMuted};
            text-decoration: none;
          }
          @media (min-width: 768px) {
            .footer-links {
              display: flex;
              flex-wrap: wrap;
              align-items: center;
              justify-content: center;
              gap: 8px 32px;
            }
          }
        `}</style>
        <style jsx global>{`
          /* Top padding matches the old py-12 (48px). Bottom padding is larger
             and viewport-scaled so the copyright row always clears the giant
             wordmark's dense bottom band — the wordmark grows with viewport
             width, so the clearance grows with it. */
          .footer-root {
            padding-top: 48px;
            padding-bottom: clamp(72px, 16vw, 200px);
          }
        `}</style>

        {/* Bottom row — simplified copyright + legal links */}
        <div
          style={{
            marginTop: '24px',
            paddingTop: '24px',
            borderTop: `1px solid ${tokens.colors.border}`,
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px 24px',
          }}
        >
          <p
            style={{
              fontSize: '13px',
              color: tokens.colors.textFaint,
              margin: 0,
            }}
          >
            &copy; 2026 SPACE8. All rights reserved.
          </p>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '24px',
            }}
          >
            <Link
              href="/legal"
              data-cms-key="footer.legal"
              style={{
                fontSize: '13px',
                color: tokens.colors.textFaint,
                textDecoration: 'none',
              }}
            >
              {t('footer.legal')}
            </Link>
            <Link
              href="/privacy"
              data-cms-key="footer.privacy"
              style={{
                fontSize: '13px',
                color: tokens.colors.textFaint,
                textDecoration: 'none',
              }}
            >
              {t('footer.privacy')}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
