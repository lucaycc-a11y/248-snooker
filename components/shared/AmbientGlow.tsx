'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

// Ambient floating gradient-orb backdrop (Gemini/Stripe-style "breathing" glow).
// Three large, heavily blurred radial blobs drift slowly behind page content.
// Purely decorative — z-index kept below content, pointer-events disabled, and
// motion is skipped entirely when the user has prefers-reduced-motion set (only
// the static blobs render, no animate loop).
//
// Reused across dark-background pages (coming-soon, homepage, login, member) —
// do not add this to light-background pages, the colors assume a black base.

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

const ORBS: Orb[] = [
  { color: '#22c55e', size: 560, top: '8%', left: '12%', moveX: [0, 90, -40, 0], moveY: [0, -60, 50, 0], duration: 14, delay: 0 },
  { color: '#f97316', size: 480, top: '55%', left: '68%', moveX: [0, -70, 50, 0], moveY: [0, 60, -50, 0], duration: 17, delay: 1.5 },
  { color: '#22c55e', size: 420, top: '72%', left: '18%', moveX: [0, 60, -60, 0], moveY: [0, -40, 30, 0], duration: 12, delay: 3 },
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

export function AmbientGlow() {
  const reducedMotion = useReducedMotion()

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden" style={{ zIndex: -1 }}>
      {ORBS.map((orb, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: orb.size,
            height: orb.size,
            top: orb.top,
            left: orb.left,
            background: `radial-gradient(circle, ${orb.color}, transparent 70%)`,
            filter: 'blur(110px)',
            opacity: 0.35,
            willChange: 'transform',
          }}
          animate={reducedMotion ? undefined : { x: orb.moveX, y: orb.moveY }}
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
