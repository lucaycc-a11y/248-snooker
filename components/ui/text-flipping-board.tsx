'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

/* ── Character set ───────────────────────────────────────────────────
   Only Latin letters, digits, and common symbols — the flap mechanism
   flips through these linearly to resolve each character. Chinese
   characters are NOT supported by the flap animation. */
const FLAP_CHARS = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,!?-\'":;/&%$#@+*='

interface TextFlippingBoardProps {
  /** Ordered list of messages to cycle through */
  messages: string[]
  /** Interval per message in ms (default 4500) */
  interval?: number
  /** Tick duration per flap step in ms (default 40) */
  tickSpeed?: number
  /** Stagger delay between characters in ms (default 30) */
  staggerDelay?: number
  /** Class name for the outer container */
  className?: string
  /** Inline styles */
  style?: React.CSSProperties
}

export default function TextFlippingBoard({
  messages,
  interval = 4500,
  tickSpeed = 40,
  staggerDelay = 30,
  className,
  style,
}: TextFlippingBoardProps) {
  const [msgIndex, setMsgIndex] = useState(0)
  const [displayChars, setDisplayChars] = useState<string[]>(() =>
    messages[0]!.toUpperCase().split(''),
  )
  const [isAnimating, setIsAnimating] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const rafRef = useRef<number | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Detect prefers-reduced-motion
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // Expose reducedMotion for callers who need it
  // (used to skip the flap animation entirely)

  const animateFlip = useCallback(
    (target: string) => {
      if (reducedMotion) {
        setDisplayChars(target.toUpperCase().split(''))
        return
      }

      setIsAnimating(true)
      const targetChars = target.toUpperCase().split('')
      const maxLen = Math.max(displayChars.length, targetChars.length)
      const current = [...displayChars]
      // Pad shorter array with spaces
      while (current.length < maxLen) current.push(' ')
      while (targetChars.length < maxLen) targetChars.push(' ')

      let step = 0
      // Each character has its own "spinner" tracking which FLAP_CHARS
      // index it has reached. We compute the shortest rotation distance.
      const charProgress = current.map((ch, i) => {
        const fromIdx = FLAP_CHARS.indexOf(ch) >= 0 ? FLAP_CHARS.indexOf(ch) : 0
        const toIdx =
          FLAP_CHARS.indexOf(targetChars[i]!) >= 0
            ? FLAP_CHARS.indexOf(targetChars[i]!)
            : 0
        // Distance: how many steps to reach target (forward only)
        const dist =
          toIdx >= fromIdx ? toIdx - fromIdx : FLAP_CHARS.length - fromIdx + toIdx
        return { fromIdx, toIdx, dist, currentIdx: fromIdx }
      })

      // Pre-compute the max distance so we know when everyone is done
      const maxDist = Math.max(...charProgress.map((p) => p.dist), 1)

      const tick = () => {
        step++
        let allDone = true
        const next = [...current]

        for (let i = 0; i < charProgress.length; i++) {
          const p = charProgress[i]!
          if (p.dist === 0) {
            // Already matches — keep as-is
            next[i] = FLAP_CHARS[p.toIdx]!
            continue
          }
          const delay = i * staggerDelay
          const effectiveSteps = Math.max(1, Math.floor(p.dist * 0.6))
          const progress = Math.min(
            1,
            Math.max(0, (step * tickSpeed - delay) / (effectiveSteps * tickSpeed)),
          )
          const idx = Math.floor(progress * p.dist)
          if (idx >= p.dist) {
            next[i] = FLAP_CHARS[p.toIdx]!
          } else {
            allDone = false
            const spinIdx = (p.fromIdx + idx) % FLAP_CHARS.length
            next[i] = FLAP_CHARS[spinIdx]!
          }
        }

        setDisplayChars(next)

        if (!allDone && step < 120) {
          rafRef.current = requestAnimationFrame(tick)
        } else {
          setDisplayChars(targetChars)
          setIsAnimating(false)
        }
      }

      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(tick)
    },
    [displayChars, reducedMotion, staggerDelay],
  )

  // Cycle through messages
  useEffect(() => {
    if (messages.length <= 1) {
      if (messages[0]) animateFlip(messages[0])
      return
    }

    intervalRef.current = setInterval(() => {
      setMsgIndex((prev) => {
        const next = (prev + 1) % messages.length
        animateFlip(messages[next]!)
        return next
      })
    }, interval)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, interval, animateFlip])

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: '0.08em',
        ...style,
      }}
      aria-live="polite"
      aria-label={messages[msgIndex] ?? ''}
    >
      <AnimatePresence mode="popLayout">
        {displayChars.map((char, i) => (
          <motion.span
            key={`${msgIndex}-${i}`}
            layout
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{
              duration: 0.25,
              delay: i * 0.02,
              ease: [0.16, 1, 0.3, 1],
            }}
            style={{
              display: 'inline-block',
              fontFamily: '"Bebas Neue", "SF Pro Display", sans-serif',
              fontWeight: 600,
              letterSpacing: '0.02em',
              minWidth: '0.08em',
              textAlign: 'center',
              color: 'inherit',
              // Simulate a flap-cell look
              background: 'rgba(255,255,255,0.04)',
              borderRadius: '4px',
              padding: '0 0.04em',
              lineHeight: 1.15,
            }}
          >
            {char === ' ' ? ' ' : char}
          </motion.span>
        ))}
      </AnimatePresence>
    </div>
  )
}