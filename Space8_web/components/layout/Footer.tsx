'use client'

import { Link } from '@/i18n/navigation'
import { Instagram, MessageCircle, MapPin } from 'lucide-react'
import { tokens } from '@/app/styles/tokens'
import { useTranslations, useLocale } from 'next-intl'
import { Logo } from '@/components/brand'
import { getVenueMapsUrl } from '@/lib/venue'

const WHATSAPP_URL = 'https://wa.me/85264274620'
const INSTAGRAM_URL = 'https://instagram.com/248snooker'

export default function Footer() {
  const t = useTranslations()
  const locale = useLocale()
  const MAPS_URL = getVenueMapsUrl(locale)

  const navLinks: { label: string; href: string }[] = [
    { label: t('nav.book'), href: '/book' },
    { label: t('nav.venue'), href: '/venue' },
    { label: t('nav.about'), href: '/about' },
    { label: t('nav.blog'), href: '/blog' },
    { label: t('footer.terms'), href: '/terms' },
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
        {/* Top — logo + social icons */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
          }}
        >
          <Logo variant="full" theme="dark" size={28} />

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

        {/* Contact — address + one-tap directions, shown on every page's footer */}
        <div
          style={{
            marginTop: '32px',
            paddingTop: '28px',
            borderTop: `1px solid ${tokens.colors.border}`,
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <MapPin size={18} strokeWidth={1.75} color={tokens.colors.textMuted} style={{ marginTop: '2px', flexShrink: 0 }} />
            <div>
              <p
                style={{
                  margin: 0,
                  fontSize: '12px',
                  color: tokens.colors.textFaint,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
                data-cms-key="footer.contact_label"
              >
                {t('footer.contact_label')}
              </p>
              <p
                style={{ margin: '4px 0 0', fontSize: '14px', color: tokens.colors.textMuted, maxWidth: '360px' }}
                data-cms-key="footer.address"
              >
                {t('footer.address')}
              </p>
            </div>
          </div>

          <a
            href={MAPS_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '14px',
              fontWeight: 600,
              color: tokens.colors.brand,
              textDecoration: 'none',
              whiteSpace: 'nowrap',
            }}
            data-cms-key="footer.directions_cta"
          >
            {t('footer.directions_cta')}
          </a>
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
