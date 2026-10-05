'use client'

import { motion } from 'framer-motion'
import { ReactNode } from 'react'
import { tokens } from '@/app/styles/tokens'

interface ThreePointItem {
  before: string
  accent: string
  after: string
  icon?: ReactNode
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
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

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
      <div
        style={{
          width: 'min(100% - 48px, 1040px)',
          marginInline: 'auto',
        }}
      >
        {heading && (
          <motion.h2
            initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.6, ease: tokens.easing.spring }}
            className="mb-12 text-center font-sans text-2xl font-semibold md:mb-16 md:text-3xl"
            style={{
              color: isLight ? '#1d1d1f' : tokens.colors.text,
            }}
          >
            {heading}
          </motion.h2>
        )}

        <div
          className="grid gap-5"
          style={{
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          }}
        >
          {items.slice(0, 3).map((item, index) => {
            const isObject = item && typeof item === 'object' && 'before' in item

            // Split text at full-width comma for two-line layout
            const renderContent = () => {
              if (isObject) {
                const fullText = `${item.before}${item.accent}${item.after}`
                const parts = fullText.split('，')

                // Case 1: Two clauses separated by comma (e.g., "網上預訂，自助入場。")
                if (parts.length === 2) {
                  const firstClause = `${parts[0]}，`
                  const secondClause = parts[1]

                  // Determine which parts are accented
                  const firstHasAccent = item.accent && firstClause.includes(item.accent)
                  const secondHasAccent = item.accent && secondClause.includes(item.accent)

                  return (
                    <>
                      <span
                        style={{
                          display: 'block',
                          whiteSpace: 'nowrap',
                          color: firstHasAccent ? accentColor : undefined,
                        }}
                      >
                        {firstClause}
                      </span>
                      <span
                        style={{
                          display: 'block',
                          whiteSpace: 'nowrap',
                          color: secondHasAccent ? accentColor : undefined,
                        }}
                      >
                        {secondClause}
                      </span>
                    </>
                  )
                }

                // Case 2: Full sentence is accented (e.g., "零打擾，全專注。")
                if (item.before === '' && item.after === '') {
                  const clauses = item.accent.split('，')
                  if (clauses.length === 2) {
                    return (
                      <>
                        <span
                          style={{
                            display: 'block',
                            whiteSpace: 'nowrap',
                            color: accentColor,
                          }}
                        >
                          {clauses[0]}，
                        </span>
                        <span
                          style={{
                            display: 'block',
                            whiteSpace: 'nowrap',
                            color: accentColor,
                          }}
                        >
                          {clauses[1]}
                        </span>
                      </>
                    )
                  }
                }

                // Fallback: inline rendering
                return (
                  <>
                    <span>{item.before}</span>
                    <span style={{ color: accentColor }}>{item.accent}</span>
                    <span>{item.after}</span>
                  </>
                )
              }

              return item
            }

            return (
              <motion.div
                key={index}
                initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.92, y: 30 }}
                whileInView={{ opacity: 1, scale: 1, y: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{
                  duration: prefersReducedMotion ? 0 : 0.5,
                  delay: prefersReducedMotion ? 0 : index * 0.12,
                  ease: popEasing,
                }}
                style={{
                  aspectRatio: '4 / 3',
                  minHeight: '220px',
                  padding: '28px',
                  borderRadius: '24px',
                  backgroundColor: isLight ? '#ffffff' : tokens.colors.surface,
                  border: `1px solid ${
                    isLight ? 'rgba(0,0,0,0.08)' : tokens.colors.border
                  }`,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                {/* Icon at TOP-LEFT */}
                {isObject && item.icon && (
                  <div
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '50%',
                      backgroundColor: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.06)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: accentColor,
                      flexShrink: 0,
                    }}
                  >
                    {item.icon}
                  </div>
                )}

                {/* Text at BOTTOM-LEFT */}
                <p
                  className="font-sans font-semibold"
                  style={{
                    fontSize: 'clamp(20px, 2.2vw, 28px)',
                    lineHeight: '1.25',
                    color: isLight ? '#1d1d1f' : tokens.colors.text,
                  }}
                >
                  {renderContent()}
                </p>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
