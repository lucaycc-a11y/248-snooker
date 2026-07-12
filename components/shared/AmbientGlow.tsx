'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

// Ambient edge-glow backdrop (Gemini/Stripe-style "breathing" glow). Color
// sources sit just outside the four corners/edges of the viewport and fade
// inward, keeping the center clean and readable for text/cards. Purely
// decorative — z-index kept below content, pointer-events disabled, and
// motion is skipped entirely when the user has prefers-reduced-motion set (only
// the static gradients render, no animate loop).
//
// Reused across dark-background pages (coming-soon, homepage, login, member) —
// do not add this to light-background pages, the colors assume a black base.
//
// 'brand' (default) is the green/orange two-tone look used on homepage/login/
// member. 'gemini' is the five-color blue/purple/pink/orange/green blend with
// mix-blend-mode: screen for the "light bleeding into light" look — currently
// scoped to /coming-soon only, pending sign-off before wider rollout.

type EdgeGlow = {
  color: string
  size: number
  position: { top?: string; bottom?: string; left?: string; right?: string }
  driftX: number[]
  driftY: number[]
  duration: number
  delay: number
}

type AmbientGlowVariant = 'brand' | 'gemini'

const BRAND_EDGES: EdgeGlow[] = [
  { color: '#22c55e', size: 900, position: { top: '-30%', left: '-25%' }, driftX: [0, 15, 0], driftY: [0, -10, 0], duration: 16, delay: 0 },
  { color: '#f97316', size: 800, position: { top: '-30%', right: '-25%' }, driftX: [0, -15, 0], driftY: [0, 10, 0], duration: 19, delay: 2 },
  { color: '#22c55e', size: 850, position: { bottom: '-30%', right: '-25%' }, driftX: [0, -10, 0], driftY: [0, -15, 0], duration: 14, delay: 4 },
  { color: '#f97316', size: 800, position: { bottom: '-30%', left: '-25%' }, driftX: [0, 10, 0], driftY: [0, 15, 0], duration: 20, delay: 1 },
]

// Google brand palette (blue/purple/pink/orange) + one brand-green source
// kept in the mix so the effect still reads as "Space8", not generic Gemini
// clone. Four sit at the corners, the fifth (green) glows from the bottom edge.
// A deep space-blue source is layered on top (center/top) to push the overall
// feel toward "space" rather than pure Gemini branding.
const GEMINI_EDGES: EdgeGlow[] = [
  { color: '#4285F4', size: 900, position: { top: '-30%', left: '-25%' }, driftX: [0, 15, 0], driftY: [0, -10, 0], duration: 15, delay: 0 },
  { color: '#A142F4', size: 850, position: { top: '-30%', right: '-25%' }, driftX: [0, -12, 0], driftY: [0, -12, 0], duration: 18, delay: 1.5 },
  { color: '#F442A1', size: 850, position: { bottom: '-30%', right: '-25%' }, driftX: [0, -15, 0], driftY: [0, 10, 0], duration: 13, delay: 3 },
  { color: '#FBBC05', size: 800, position: { bottom: '-30%', left: '-25%' }, driftX: [0, 12, 0], driftY: [0, 12, 0], duration: 20, delay: 4.5 },
  { color: '#22c55e', size: 700, position: { bottom: '-25%', left: '30%' }, driftX: [0, 10, 0], driftY: [0, 8, 0], duration: 17, delay: 6 },
  { color: '#3B82F6', size: 950, position: { top: '-35%', left: '30%' }, driftX: [0, -10, 0], driftY: [0, 12, 0], duration: 22, delay: 2.5 },
]

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(query.matches)
    const onChange = () => setReduced(query.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])
  return reduced
}

export function AmbientGlow({ variant = 'brand' }: { variant?: AmbientGlowVariant }) {
  const reducedMotion = useReducedMotion()
  const edges = variant === 'gemini' ? GEMINI_EDGES : BRAND_EDGES
  const blendMode = variant === 'gemini' ? 'screen' : undefined
  const baseOpacity = variant === 'gemini' ? 0.12 : 0.1
  const pulseRange = variant === 'gemini' ? [0.08, 0.15, 0.08] : [0.07, 0.13, 0.07]

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden bg-black" style={{ zIndex: -1 }}>
      {edges.map((edge, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: edge.size,
            height: edge.size,
            ...edge.position,
            // Sources sit outside the viewport edges and stay fully
            // transparent past 35% so the center of the page stays clean —
            // only the outer ring of light reaches inward.
            background: `radial-gradient(circle, ${edge.color}80, transparent 35%)`,
            filter: 'blur(200px)',
            opacity: baseOpacity,
            mixBlendMode: blendMode,
            willChange: 'transform',
          }}
          animate={
            reducedMotion
              ? undefined
              : { x: edge.driftX, y: edge.driftY, opacity: pulseRange }
          }
          transition={
            reducedMotion
              ? undefined
              : { duration: edge.duration, delay: edge.delay, repeat: Infinity, ease: 'easeInOut' }
          }
        />
      ))}
    </div>
  )
}
