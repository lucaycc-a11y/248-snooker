'use client'

import { useState } from 'react'
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

  return (
    <>
      <nav
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          height: 64,
          backgroundColor: tokens.colors.bg,
          borderBottom: `1px solid ${tokens.colors.border}`,
          display: 'flex',
          alignItems: 'center',
          padding: '0 20px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            maxWidth: 1100,
            margin: '0 auto',
          }}
        >
          {/* Left: Logo */}
          <Link href="/" style={{ display: 'flex', alignItems: 'center' }}>
            <Logo variant="full" size={40} />
          </Link>

          {/* Right: Desktop nav */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '32px',
            }}
            className="hidden md:flex"
          >
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                style={{
                  fontSize: '15px',
                  fontWeight: 500,
                  color: pathname === link.href ? tokens.colors.text : tokens.colors.textMuted,
                  textDecoration: 'none',
                  transition: `color ${tokens.duration.fast}`,
                }}
              >
                {link.label}
              </Link>
            ))}
            <Link href="/book">
              <Button variant="primary" size="sm">
                立即預訂
              </Button>
            </Link>
          </div>

          {/* Right: Mobile */}
          <div className="flex md:hidden" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Link href="/book">
              <Button variant="primary" size="sm">
                立即預訂
              </Button>
            </Link>
            <button
              onClick={() => setMenuOpen(true)}
              style={{
                background: 'none',
                border: 'none',
                color: tokens.colors.text,
                cursor: 'pointer',
                padding: '8px',
              }}
              aria-label="開啟選單"
            >
              <Menu size={24} />
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
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
              backgroundColor: tokens.colors.bg,
              display: 'flex',
              flexDirection: 'column',
              padding: '20px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setMenuOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: tokens.colors.text,
                  cursor: 'pointer',
                  padding: '8px',
                }}
                aria-label="關閉選單"
              >
                <X size={24} />
              </button>
            </div>
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '32px',
              }}
            >
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  style={{
                    fontSize: '28px',
                    fontWeight: 600,
                    color: pathname === link.href ? tokens.colors.brand : tokens.colors.text,
                    textDecoration: 'none',
                  }}
                >
                  {link.label}
                </Link>
              ))}
            </div>
            <div style={{ paddingBottom: '40px' }}>
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
