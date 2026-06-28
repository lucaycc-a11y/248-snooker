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

type NavTheme = 'dark' | 'light'

const PILL_TRANSITION = 'all 0.25s ease'

// Pill chrome resolves from the background behind the navbar.
function pillStyle(theme: NavTheme): React.CSSProperties {
  const dark = theme === 'dark'
  return {
    background: dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
    border: `1px solid ${dark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.15)'}`,
    backdropFilter: 'blur(20px) saturate(180%)',
    WebkitBackdropFilter: 'blur(20px) saturate(180%)',
    borderRadius: 999,
    pointerEvents: 'auto',
    transition: PILL_TRANSITION,
  }
}

export default function Nav() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [theme, setTheme] = useState<NavTheme>('dark')
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

  // Auto light/dark: on scroll, read whatever element sits directly behind the
  // navbar and walk up to its [data-nav-theme]; fall back to bg luminance.
  // Sample below the pill (y=72) so the pill itself isn't what's hit-tested.
  useEffect(() => {
    const updateNavTheme = () => {
      const probeX = window.innerWidth / 2
      const el = document.elementFromPoint(probeX, 72)
      if (!el) return

      let target: Element | null = el
      while (target && target !== document.body) {
        const t = target.getAttribute('data-nav-theme')
        if (t === 'dark' || t === 'light') {
          setTheme(t)
          return
        }
        target = target.parentElement
      }

      // No tagged ancestor — infer from the element's background luminance.
      const bg = window.getComputedStyle(el).backgroundColor
      const rgb = bg.match(/\d+/g)?.map(Number) ?? [0, 0, 0]
      const luminance = (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000
      setTheme(luminance < 128 ? 'dark' : 'light')
    }

    updateNavTheme()
    window.addEventListener('scroll', updateNavTheme, { passive: true })
    window.addEventListener('resize', updateNavTheme, { passive: true })
    return () => {
      window.removeEventListener('scroll', updateNavTheme)
      window.removeEventListener('resize', updateNavTheme)
    }
  }, [pathname])

  const linkColor = theme === 'dark' ? '#ffffff' : '#1a1a1a'

  return (
    <>
      {/* Wrapper — transparent, centred, clicks pass through empty areas */}
      <nav
        style={{
          position: 'fixed',
          top: 20,
          left: 0,
          right: 0,
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 16px',
          background: 'transparent',
          border: 'none',
          pointerEvents: 'none',
        }}
        className="nav-bar"
      >
        {/* Logo — floats top-left, absolute so the pill stays centred */}
        <Link
          href="/"
          style={{
            position: 'absolute',
            left: 16,
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex',
            alignItems: 'center',
            pointerEvents: 'auto',
          }}
          className="nav-logo"
        >
          <Logo variant="full" theme={theme} size={28} />
        </Link>

        {/* Desktop links — centred frosted pill */}
        <div
          className="nav-center"
          style={{
            ...pillStyle(theme),
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
                  color: active ? tokens.colors.brand : linkColor,
                  textDecoration: 'none',
                  whiteSpace: 'nowrap',
                  transition: PILL_TRANSITION,
                }}
              >
                {link.label}
              </Link>
            )
          })}
        </div>

        {/* Mobile — hamburger pill, floats top-right */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="nav-hamburger"
          style={{
            ...pillStyle(theme),
            position: 'absolute',
            right: 16,
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 48,
            height: 44,
            cursor: 'pointer',
            color: linkColor,
            padding: 0,
            WebkitTapHighlightColor: 'transparent',
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

        {/* Desktop — Book CTA, floats top-right */}
        <Link
          href="/book"
          className="nav-cta-desktop"
          style={{
            position: 'absolute',
            right: 32,
            top: '50%',
            transform: 'translateY(-50%)',
            textDecoration: 'none',
            pointerEvents: 'auto',
            display: 'none',
          }}
        >
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
          .nav-hamburger {
            display: none !important;
          }
          .nav-cta-desktop {
            display: block !important;
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
