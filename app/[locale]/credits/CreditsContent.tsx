'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import TextFlippingBoard from '@/components/ui/text-flipping-board'
import { tokens } from '@/app/styles/tokens'

const EASE = [0.2, 0.7, 0.3, 1] as const
const VIEWPORT = { once: true, amount: 0.25 } as const

export default function CreditsContent() {
  const t = useTranslations('creditsPage')
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return (
    <>
      {/* ── Hero / Flip Board Section ── */}
      <section
        style={{
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '120px 24px 80px',
          background: tokens.colors.bg,
        }}
      >
        <div style={{ maxWidth: 900, width: '100%', textAlign: 'center' }}>
          {reducedMotion ? (
            // Reduced motion: show final resolved text immediately
            <h1
              style={{
                fontFamily: tokens.font.display,
                fontSize: 'clamp(2.8rem, 12vw, 6rem)',
                letterSpacing: '0.04em',
                color: tokens.colors.text,
                lineHeight: 1.1,
                margin: 0,
              }}
            >
              SPACE8
            </h1>
          ) : (
            <TextFlippingBoard
              messages={t.raw('flap_messages') as string[]}
              interval={5000}
              lastMessageDuration={9000}
              lastMessageUrl="https://formhk.com"
              tickSpeed={40}
              staggerDelay={30}
              style={{
                fontFamily: tokens.font.display,
                fontSize: 'clamp(2.8rem, 12vw, 6rem)',
                letterSpacing: '0.04em',
                color: tokens.colors.text,
                lineHeight: 1.1,
              }}
            />
          )}
        </div>
      </section>

      {/* ── Static Credit Content ── */}
      <section
        style={{
          padding: '100px 24px 140px',
          background: tokens.colors.surface,
        }}
      >
        <div
          style={{
            maxWidth: 680,
            margin: '0 auto',
          }}
        >
          {/* Primary credit copy — 繁體中文 */}
          <motion.div
            initial={reducedMotion ? {} : { opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={VIEWPORT}
            transition={{ duration: 0.8, ease: EASE }}
          >
            <p
              style={{
                fontFamily:
                  '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Noto Sans TC", "PingFang TC", sans-serif',
                fontSize: 'clamp(1.05rem, 2.4vw, 1.35rem)',
                lineHeight: 1.9,
                color: tokens.colors.text,
                margin: 0,
              }}
            >
              {t('main_description_line1')}
              <br />
              {t('main_description_line2')}
              <br />
              {t('main_description_line3')}
            </p>
          </motion.div>

          {/* Secondary / tools credit */}
          <motion.div
            initial={reducedMotion ? {} : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={VIEWPORT}
            transition={{ duration: 0.8, ease: EASE, delay: 0.2 }}
            style={{ marginTop: 48 }}
          >
            <p
              style={{
                fontSize: '13px',
                lineHeight: 1.8,
                color: tokens.colors.textFaint,
                fontFamily:
                  '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Noto Sans TC", sans-serif',
                margin: 0,
              }}
            >
              {t('tech_stack')}
            </p>
          </motion.div>

          {/* Decorative divider */}
          <motion.div
            initial={reducedMotion ? {} : { opacity: 0, scaleX: 0 }}
            whileInView={{ opacity: 1, scaleX: 1 }}
            viewport={VIEWPORT}
            transition={{ duration: 0.6, ease: EASE, delay: 0.35 }}
            style={{
              marginTop: 64,
              height: 1,
              background: tokens.colors.border,
              transformOrigin: 'left center',
            }}
          />

          {/* Closing note */}
          <motion.p
            initial={reducedMotion ? {} : { opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={VIEWPORT}
            transition={{ duration: 0.6, ease: EASE, delay: 0.45 }}
            style={{
              marginTop: 32,
              fontSize: '14px',
              lineHeight: 1.7,
              color: tokens.colors.textMuted,
              fontFamily:
                '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Noto Sans TC", sans-serif',
            }}
          >
            {t('footer.credits_closing')}
          </motion.p>
        </div>
      </section>
    </>
  )
}