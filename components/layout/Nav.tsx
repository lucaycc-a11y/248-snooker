'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { tokens } from '@/app/styles/tokens'
import { Logo } from '@/components/brand'
import { Button } from '@/components/ui'

const navLinks = [
  { href: '/book', label: '預訂' },
  { href: '/pricing', label: '定價' },
  { href: '/about', label: '關於' },
  { href: '/blog', label: 'Blog' },
]

// Frosted-glass pill — the only element in the nav with a background.
const PILL_STYLE: React.CSSProperties = {
  background: 'rgba(255,255,255,0.12)',
  backdropFilter: 'blur(20px) saturate(180%)',
  WebkitBackdropFilter: 'blur(20px) saturate(180%)',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: 999,
  pointerEvents: 'auto',
}

export default function Nav() {
  const [menuOpen, setMenuOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [menuOpen])

  return (
    <>
      {/* Wrapper — fully transparent, clicks pass through empty areas */}
      <nav
        style={{
          position: 'fixed',
          top: 20,
          left: 0,
          right: 0,
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          background: 'transparent',
          backdropFilter: 'none',
          WebkitBackdropFilter: 'none',
          border: 'none',
          boxShadow: 'none',
          pointerEvents: 'none',
        }}
        className="nav-bar"
      >
        {/* Left: Logo — floats freely */}
        <Link
          href="/"
          style={{
            display: 'flex',
            alignItems: 'center',
            flexShrink: 0,
            pointerEvents: 'auto',
          }}
        >
          <Logo variant="full" size={28} />
        </Link>

        {/* Center: Desktop links inside frosted pill */}
        <div
          className="nav-center"
          style={{
            ...PILL_STYLE,
            display: 'none',
            alignItems: 'center',
            gap: 28,
            padding: '10px 24px',
          }}
        >
          {navLinks.map((link) => {
            const active = pathname === link.href
            return (
              <Link
                key={link.href}
                href={link.href}
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: active ? tokens.colors.brand : tokens.colors.text,
                  textDecoration: 'none',
                  whiteSpace: 'nowrap',
                  transition: `color ${tokens.duration.fast}`,
                }}
              >
                {link.label}
              </Link>
            )
          })}
        </div>

        {/* Right: Mobile — CTA floats + hamburger pill */}
        <div
          className="nav-right-mobile"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexShrink: 0,
            pointerEvents: 'none',
          }}
        >
          <Link href="/book" style={{ textDecoration: 'none', pointerEvents: 'auto' }}>
            <span
              data-cms-key="nav.cta"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: tokens.colors.brand,
                color: '#000',
                borderRadius: tokens.radius.pill,
                padding: '10px 20px',
                fontWeight: 700,
                fontSize: 15,
                whiteSpace: 'nowrap',
              }}
            >
              立即預訂
            </span>
          </Link>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="nav-hamburger"
            style={{
              ...PILL_STYLE,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 48,
              height: 44,
              cursor: 'pointer',
              color: tokens.colors.text,
              padding: 0,
              WebkitTapHighlightColor: 'transparent',
              position: 'relative',
            }}
            aria-label={menuOpen ? '關閉選單' : '開啟選單'}
          >
            <motion.span
              animate={{ rotate: menuOpen ? 90 : 0, opacity: menuOpen ? 0 : 1 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              style={{ position: 'absolute', display: 'flex' }}
            >
              <Menu size={20} />
            </motion.span>
            <motion.span
              animate={{ rotate: menuOpen ? 0 : -90, opacity: menuOpen ? 1 : 0 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              style={{ position: 'absolute', display: 'flex' }}
            >
              <X size={20} />
            </motion.span>
          </button>
        </div>

        {/* Right: Desktop — Login + Book Now, floating */}
        <div
          className="nav-right-desktop"
          style={{
            display: 'none',
            alignItems: 'center',
            gap: 8,
            flexShrink: 0,
            pointerEvents: 'none',
          }}
        >
          <Link href="/login" style={{ textDecoration: 'none', pointerEvents: 'auto' }}>
            <span
              data-cms-key="nav.login"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: tokens.colors.text,
                fontSize: 14,
                fontWeight: 500,
                ...PILL_STYLE,
                padding: '10px 18px',
                whiteSpace: 'nowrap',
                cursor: 'pointer',
              }}
            >
              Login
            </span>
          </Link>
          <Link href="/book" style={{ textDecoration: 'none', pointerEvents: 'auto' }}>
            <span
              data-cms-key="nav.book-desktop"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: tokens.colors.brand,
                color: '#000',
                borderRadius: tokens.radius.pill,
                padding: '10px 20px',
                fontWeight: 700,
                fontSize: 14,
                whiteSpace: 'nowrap',
              }}
            >
              立即預訂
            </span>
          </Link>
        </div>
      </nav>

      {/* Responsive breakpoint styles */}
      <style jsx global>{`
        @media (min-width: 768px) {
          .nav-bar {
            padding: 0 32px !important;
          }
          .nav-center {
            display: flex !important;
          }
          .nav-right-mobile {
            display: none !important;
          }
          .nav-right-desktop {
            display: flex !important;
          }
        }
      `}</style>

      {/* Mobile fullscreen menu overlay */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 40,
              background: 'rgba(0,0,0,0.92)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              padding: '48px 32px',
            }}
          >
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 32,
              }}
            >
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  data-cms-key={`nav.link.${link.href.slice(1)}`}
                  style={{
                    fontSize: 32,
                    fontWeight: 600,
                    color: tokens.colors.text,
                    textDecoration: 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {link.label}
                </Link>
              ))}
            </div>

            <div style={{ width: '100%', paddingTop: 32 }}>
              <Link href="/book" onClick={() => setMenuOpen(false)} style={{ textDecoration: 'none' }}>
                <Button variant="primary" size="lg" fullWidth>
                  立即預訂
                </Button>
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
