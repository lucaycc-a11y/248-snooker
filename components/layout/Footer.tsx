'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { tokens } from '@/app/styles/tokens'
import { Logo } from '@/components/brand'

type FooterSection = {
  title: string
  links: { label: string; href: string }[]
}

const sections: FooterSection[] = [
  {
    title: '產品',
    links: [
      { label: 'FORM Flow', href: '/flow' },
      { label: 'Clarté', href: '/clarte' },
      { label: 'Pay', href: '/pay' },
    ],
  },
  {
    title: '公司',
    links: [
      { label: '關於', href: '/about' },
      { label: 'Blog', href: '/blog' },
      { label: '聯絡', href: '/contact' },
    ],
  },
  {
    title: '法律',
    links: [
      { label: '私隱政策', href: '/privacy' },
      { label: '條款', href: '/terms' },
    ],
  },
  {
    title: '社交',
    links: [
      { label: 'Instagram', href: 'https://instagram.com/248snooker' },
      { label: 'WhatsApp', href: 'https://wa.me/85200000000' },
    ],
  },
]

function FooterAccordion({ section }: { section: FooterSection }) {
  const [open, setOpen] = useState(false)

  return (
    <div style={{ borderBottom: `1px solid ${tokens.colors.border}` }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          padding: '16px 0',
          background: 'none',
          border: 'none',
          color: tokens.colors.textMuted,
          fontSize: '13px',
          fontWeight: 600,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          cursor: 'pointer',
        }}
      >
        {section.title}
        <ChevronDown
          size={16}
          style={{
            transform: open ? 'rotate(180deg)' : 'rotate(0)',
            transition: `transform ${tokens.duration.fast}`,
          }}
        />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ paddingBottom: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {section.links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  style={{
                    fontSize: '14px',
                    color: tokens.colors.textMuted,
                    textDecoration: 'none',
                  }}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function Footer() {
  return (
    <footer
      style={{
        backgroundColor: tokens.colors.bg,
        borderTop: `1px solid ${tokens.colors.border}`,
        padding: '48px 20px 32px',
      }}
    >
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        {/* Desktop grid */}
        <div className="hidden md:grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: '48px' }}>
          {sections.map((section) => (
            <div key={section.title}>
              <h4
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: tokens.colors.textMuted,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  marginBottom: '16px',
                }}
              >
                {section.title}
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {section.links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    style={{
                      fontSize: '14px',
                      color: tokens.colors.textMuted,
                      textDecoration: 'none',
                    }}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Mobile accordion */}
        <div className="block md:hidden">
          {sections.map((section) => (
            <FooterAccordion key={section.title} section={section} />
          ))}
        </div>

        {/* Bottom bar */}
        <div
          style={{
            marginTop: '48px',
            paddingTop: '24px',
            borderTop: `1px solid ${tokens.colors.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Logo variant="mark" size={24} />
            <span style={{ fontSize: '13px', color: tokens.colors.textFaint }}>
              &copy; 2026 FORM
            </span>
          </div>
        </div>
      </div>
    </footer>
  )
}
