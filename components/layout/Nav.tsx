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
      {/* Floating pill nav */}
      <nav
        style={{
          position: 'fixed',
          top: 16,
          left: 16,
          right: 16,
          zIndex: 50,
          display: 'flex',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 1000,
            height: 56,
            borderRadius: tokens.radius.pill,
            background: 'rgba(20,20,20,0.6)',
            backdropFilter: 'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            border: '1px solid rgba(255,255,255,0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 8px 0 20px',
            pointerEvents: 'auto',
          }}
        >
          {/* Left: Logo */}
          <Link
            href="/"
            style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}
          >
            <Logo variant="full" size={22} />
          </Link>

          {/* Center: Desktop links */}
          <div
            className="hidden md:flex"
            style={{
              display: 'none',
              alignItems: 'center',
              gap: 28,
            }}
          >
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color:
                    pathname === link.href
                      ? tokens.colors.brand
                      : tokens.colors.text,
                  textDecoration: 'none',
                  whiteSpace: 'nowrap',
                  opacity: pathname === link.href ? 1 : 0.7,
                  transition: `opacity ${tokens.duration.fast}, color ${tokens.duration.fast}`,
                }}
                onMouseEnter={(e) => {
                  if (pathname !== link.href) {
                    e.currentTarget.style.opacity = '1'
                  }
                }}
                onMouseLeave={(e) => {
                  if (pathname !== link.href) {
                    e.currentTarget.style.opacity = '0.7'
                  }
                }}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Right: CTA + hamburger (mobile) / CTA only (desktop) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexShrink: 0,
            }}
          >
            <Link href="/book">
              <Button variant="primary" size="sm">
                立即預訂
              </Button>
            </Link>
            {/* Hamburger - mobile only */}
            <button
              onClick={() => setMenuOpen(true)}
              className="flex md:hidden"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'none',
                border: 'none',
                color: tokens.colors.text,
                cursor: 'pointer',
                padding: 8,
                borderRadius: '50%',
                WebkitTapHighlightColor: 'transparent',
              }}
              aria-label="開啟選單"
            >
              <Menu size={22} />
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile fullscreen menu overlay */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 100,
              background: 'rgba(0,0,0,0.85)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              display: 'flex',
              flexDirection: 'column',
              padding: 20,
            }}
          >
            {/* Close button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setMenuOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: tokens.colors.text,
                  cursor: 'pointer',
                  padding: 8,
                }}
                aria-label="關閉選單"
              >
                <X size={24} />
              </button>
            </div>

            {/* Links */}
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
                  style={{
                    fontSize: 28,
                    fontWeight: 600,
                    color:
                      pathname === link.href
                        ? tokens.colors.brand
                        : tokens.colors.text,
                    textDecoration: 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {link.label}
                </Link>
              ))}
            </div>

            {/* Bottom CTA */}
            <div style={{ paddingBottom: 40 }}>
              <Link href="/book" onClick={() => setMenuOpen(false)}>
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
