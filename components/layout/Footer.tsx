'use client'

import Link from 'next/link'
import { Instagram, MessageCircle } from 'lucide-react'
import { tokens } from '@/app/styles/tokens'

const WHATSAPP_URL = 'https://wa.me/85264274620'
const INSTAGRAM_URL = 'https://instagram.com/248snooker'

const BEBAS = "'Bebas Neue', system-ui, sans-serif"

const navLinks: { label: string; href: string }[] = [
  { label: '預訂', href: '/book' },
  { label: '定價', href: '/pricing' },
  { label: '關於', href: '/about' },
  { label: 'Blog', href: '/blog' },
  { label: '條款及細則', href: '/terms' },
  { label: '私隱政策', href: '/privacy' },
]

export default function Footer() {
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
        {/* Top — wordmark + social icons */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
          }}
        >
          <span
            style={{
              fontFamily: BEBAS,
              color: tokens.colors.text,
              fontSize: '28px',
              letterSpacing: '0.04em',
              lineHeight: 1,
            }}
          >
            248 Snooker
          </span>

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
          &copy; 2026 248 Snooker · 香港24小時自助桌球會所
        </p>
      </div>
    </footer>
  )
}
