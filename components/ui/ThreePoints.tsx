'use client'

import { motion } from 'framer-motion'
import { ReactNode } from 'react'
import { tokens } from '@/app/styles/tokens'

interface ThreePointItem {
  before: string
  accent: string
  after: string
}

export interface ThreePointsProps {
  /** Optional section heading */
  heading?: string
  /** Exactly three items, each with before/accent/after structure or a ReactNode */
  items: (ThreePointItem | ReactNode)[]
  /** Theme: light (white cards) or dark (graphite surface cards) */
  theme?: 'light' | 'dark'
  /** Accent color token for highlighted text */
  accentColor?: string
}

const popEasing = [0.34, 1.56, 0.64, 1] as const

export function ThreePoints({
  heading,
  items,
  theme = 'light',
  accentColor = tokens.colors.green[600],
}: ThreePointsProps) {
  if (items.length !== 3) {
    console.warn('ThreePoints expects exactly 3 items')
  }

  const isLight = theme === 'light'

  return (
    <section
      className="w-full"
      style={{
        backgroundColor: isLight ? '#ffffff' : tokens.colors.bg,
        borderTopLeftRadius: isLight ? '32px' : 0,
        borderTopRightRadius: isLight ? '32px' : 0,
        borderTop: isLight ? '1px solid rgba(0,0,0,0.08)' : 'none',
        paddingTop: isLight ? '80px' : '64px',
        paddingBottom: '120px',
      }}
    >
      <div className="mx-auto max-w-7xl px-6 md:px-12">
        {heading && (
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.6, ease: tokens.easing.spring }}
            className="mb-12 text-center font-sans text-2xl font-semibold md:mb-16 md:text-3xl"
            style={{
              color: isLight ? '#1d1d1f' : tokens.colors.text,
            }}
          >
            {heading}
          </motion.h2>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
          {items.slice(0, 3).map((item, index) => {
            const isObject = item && typeof item === 'object' && 'before' in item
            const content = isObject ? (
              <>
                <span>{item.before}</span>
                <span style={{ color: accentColor }}>{item.accent}</span>
                <span>{item.after}</span>
              </>
            ) : (
              item
            )

            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.92, y: 30 }}
                whileInView={{ opacity: 1, scale: 1, y: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{
                  duration: 0.5,
                  delay: index * 0.12,
                  ease: popEasing,
                }}
                className="flex min-h-[280px] flex-col justify-end rounded-[20px] p-8 md:min-h-[320px] md:p-10"
                style={{
                  backgroundColor: isLight ? '#ffffff' : tokens.colors.surface,
                  border: `1px solid ${
                    isLight ? 'rgba(0,0,0,0.08)' : tokens.colors.border
                  }`,
                }}
              >
                <p
                  className="font-sans text-xl font-medium leading-snug md:text-2xl md:leading-snug lg:text-[28px] lg:leading-tight"
                  style={{
                    color: isLight ? '#1d1d1f' : tokens.colors.text,
                  }}
                >
                  {content}
                </p>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
