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
      <nav
        style={{
          position: 'sticky',
          top: 0,
          width: '100%',
          zIndex: 50,
          height: 64,
          background: tokens.colors.bg,
          borderBottom: `1px solid ${tokens.colors.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
        }}
        className="nav-bar"
      >
        {/* Left: Logo */}
        <Link
          href="/"
          style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}
        >
          <Logo variant="full" size={28} />
        </Link>

        {/* Center: Desktop links in pill group */}
        <div
          className="nav-center"
          style={{
            display: 'none',
            alignItems: 'center',
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: tokens.radius.pill,
            padding: '6px 8px',
            gap: 0,
          }}
        >
          {navLinks.map((link, i) => (
            <div key={link.href} style={{ display: 'flex', alignItems: 'center' }}>
              {i === navLinks.length - 1 && (
                <div
                  style={{
                    width: 1,
                    height: 16,
                    background: 'rgba(255,255,255,0.1)',
                  }}
                />
              )}
              <Link
                href={link.href}
                style={{
                  padding: '6px 16px',
                  fontSize: 14,
                  fontWeight: 500,
                  color: pathname === link.href ? '#000' : tokens.colors.text,
                  background: pathname === link.href ? '#fff' : 'transparent',
                  borderRadius: tokens.radius.pill,
                  textDecoration: 'none',
                  whiteSpace: 'nowrap',
                  transition: `background ${tokens.duration.fast}, color ${tokens.duration.fast}`,
                }}
                onMouseEnter={(e) => {
                  if (pathname !== link.href) {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.1)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (pathname !== link.href) {
                    e.currentTarget.style.background = 'transparent'
                  }
                }}
              >
                {link.label}
              </Link>
            </div>
          ))}
        </div>

        {/* Right: Mobile — CTA pill + hamburger pill */}
        <div
          className="nav-right-mobile"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexShrink: 0,
          }}
        >
          <Link href="/book" style={{ textDecoration: 'none' }}>
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
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: tokens.radius.pill,
              width: 48,
              height: 40,
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

        {/* Right: Desktop — Login ghost + Book Now green */}
        <div
          className="nav-right-desktop"
          style={{
            display: 'none',
            alignItems: 'center',
            gap: 8,
            flexShrink: 0,
          }}
        >
          <Link href="/login" style={{ textDecoration: 'none' }}>
            <span
              data-cms-key="nav.login"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: tokens.colors.text,
                fontSize: 14,
                fontWeight: 500,
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: tokens.radius.pill,
                padding: '8px 16px',
                whiteSpace: 'nowrap',
                cursor: 'pointer',
                background: 'transparent',
                transition: `background ${tokens.duration.fast}`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.08)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
              }}
            >
              Login
            </span>
          </Link>
          <Link href="/book" style={{ textDecoration: 'none' }}>
            <span
              data-cms-key="nav.book-desktop"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: tokens.colors.brand,
                color: '#000',
                borderRadius: tokens.radius.pill,
                padding: '8px 20px',
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
