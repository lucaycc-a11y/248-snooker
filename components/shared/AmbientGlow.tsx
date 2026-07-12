'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

// Ambient floating gradient-orb backdrop (Gemini/Stripe-style "breathing" glow).
// Heavily blurred radial blobs drift slowly behind page content. Purely
// decorative — z-index kept below content, pointer-events disabled, and
// motion is skipped entirely when the user has prefers-reduced-motion set (only
// the static blobs render, no animate loop).
//
// Reused across dark-background pages (coming-soon, homepage, login, member) —
// do not add this to light-background pages, the colors assume a black base.
//
// 'brand' (default) is the green/orange two-tone look used on homepage/login/
// member. 'gemini' is the five-color blue/purple/pink/orange/green blend with
// mix-blend-mode: screen for the "light bleeding into light" look — currently
// scoped to /coming-soon only, pending sign-off before wider rollout.

type Orb = {
  color: string
  size: number
  top: string
  left: string
  moveX: number[]
  moveY: number[]
  duration: number
  delay: number
}

type AmbientGlowVariant = 'brand' | 'gemini'

const BRAND_ORBS: Orb[] = [
  { color: '#22c55e', size: 560, top: '8%', left: '12%', moveX: [0, 90, -40, 0], moveY: [0, -60, 50, 0], duration: 14, delay: 0 },
  { color: '#f97316', size: 480, top: '55%', left: '68%', moveX: [0, -70, 50, 0], moveY: [0, 60, -50, 0], duration: 17, delay: 1.5 },
  { color: '#22c55e', size: 420, top: '72%', left: '18%', moveX: [0, 60, -60, 0], moveY: [0, -40, 30, 0], duration: 12, delay: 3 },
]

// Google brand palette (blue/purple/pink/orange) + one brand-green orb kept
// in the mix so the effect still reads as "Space8", not generic Gemini clone.
const GEMINI_ORBS: Orb[] = [
  { color: '#4285F4', size: 600, top: '10%', left: '15%', moveX: [0, 80, -60, 0], moveY: [0, -60, 90, 0], duration: 10, delay: 0 },
  { color: '#A142F4', size: 500, top: '60%', left: '70%', moveX: [0, -80, 60, 0], moveY: [0, 60, -90, 0], duration: 12.5, delay: 1.2 },
  { color: '#F442A1', size: 550, top: '30%', left: '75%', moveX: [0, 70, -50, 0], moveY: [0, -50, 70, 0], duration: 15, delay: 2.4 },
  { color: '#FBBC05', size: 450, top: '75%', left: '20%', moveX: [0, -60, 80, 0], moveY: [0, 80, -60, 0], duration: 17.5, delay: 3.6 },
  { color: '#22c55e', size: 600, top: '45%', left: '45%', moveX: [0, 60, -70, 0], moveY: [0, -70, 60, 0], duration: 20, delay: 4.8 },
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
  const orbs = variant === 'gemini' ? GEMINI_ORBS : BRAND_ORBS
  const blendMode = variant === 'gemini' ? 'screen' : undefined

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden bg-black" style={{ zIndex: -1 }}>
      {orbs.map((orb, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: orb.size,
            height: orb.size,
            top: orb.top,
            left: orb.left,
            // 80 = ~50% alpha at the orb's core, fading out earlier (60%) so
            // there's no visible disc edge once blurred.
            background: `radial-gradient(circle, ${orb.color}80, transparent 60%)`,
            filter: 'blur(180px)',
            opacity: variant === 'gemini' ? 0.16 : 0.15,
            mixBlendMode: blendMode,
            willChange: 'transform',
          }}
          animate={
            reducedMotion
              ? undefined
              : { x: orb.moveX, y: orb.moveY, opacity: variant === 'gemini' ? [0.12, 0.18, 0.12] : [0.11, 0.16, 0.11] }
          }
          transition={
            reducedMotion
              ? undefined
              : { duration: orb.duration, delay: orb.delay, repeat: Infinity, ease: 'easeInOut' }
          }
        />
      ))}
    </div>
  )
}
