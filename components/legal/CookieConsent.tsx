'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Cookie, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'

const COOKIE_CONSENT_KEY = 'space8_cookie_consent'

type ConsentValue = 'all' | 'necessary' | null

export function CookieConsent() {
  const t = useTranslations('cookie_consent')
  const [consent, setConsent] = useState<ConsentValue>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    // Check if user has already made a choice
    const stored = localStorage.getItem(COOKIE_CONSENT_KEY)
    if (stored === 'all' || stored === 'necessary') {
      setConsent(stored)
    }
  }, [])

  const handleAcceptAll = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, 'all')
    setConsent('all')
  }

  const handleNecessaryOnly = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, 'necessary')
    setConsent('necessary')
  }

  const handleDismiss = () => {
    // Treat dismiss as "necessary only" — user chose not to accept analytics
    localStorage.setItem(COOKIE_CONSENT_KEY, 'necessary')
    setConsent('necessary')
  }

  // Don't render on server or if consent already given
  if (!mounted || consent !== null) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          padding: '16px',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            background: 'rgba(10, 10, 10, 0.98)',
            backdropFilter: 'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
            pointerEvents: 'auto',
          }}
        >
          <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
            {/* Icon */}
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: 'rgba(34, 197, 94, 0.1)',
                border: '1px solid rgba(34, 197, 94, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Cookie size={20} style={{ color: '#22c55e' }} />
            </div>

            {/* Content */}
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: '16px',
                  fontWeight: 600,
                  color: '#ffffff',
                  marginBottom: '8px',
                }}
              >
                {t('title')}
              </div>
              <div
                style={{
                  fontSize: '14px',
                  color: '#a3a3a3',
                  lineHeight: 1.6,
                  marginBottom: '16px',
                }}
              >
                {t('message')}{' '}
                <Link
                  href="/legal?doc=cookie_policy"
                  style={{
                    color: '#22c55e',
                    textDecoration: 'underline',
                    textUnderlineOffset: '2px',
                  }}
                >
                  {t('learn_more')}
                </Link>
              </div>

              {/* Buttons */}
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '12px',
                  alignItems: 'center',
                }}
              >
                <button
                  type="button"
                  onClick={handleAcceptAll}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '10px',
                    border: 'none',
                    background: '#22c55e',
                    color: '#000000',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {t('accept_all')}
                </button>
                <button
                  type="button"
                  onClick={handleNecessaryOnly}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '10px',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    background: 'transparent',
                    color: '#ffffff',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {t('necessary_only')}
                </button>
              </div>
            </div>

            {/* Close button */}
            <button
              type="button"
              aria-label={t('dismiss')}
              onClick={handleDismiss}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                border: 'none',
                background: 'rgba(255, 255, 255, 0.05)',
                color: '#a3a3a3',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
