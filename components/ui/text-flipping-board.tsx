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
  /** Longer interval for the last (CTA) message in ms — lets the call-to-action
   *  breathe before the cycle restarts (default same as interval) */
  lastMessageDuration?: number
  /** Optional URL to make the last message clickable (subtle hover underline) */
  lastMessageUrl?: string
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
  lastMessageDuration,
  lastMessageUrl,
  tickSpeed = 40,
  staggerDelay = 30,
  className,
  style,
}: TextFlippingBoardProps) {
  const [mounted, setMounted] = useState(false)
  const [msgIndex, setMsgIndex] = useState(0)
  const [displayChars, setDisplayChars] = useState<string[]>(() =>
    messages[0]!.toUpperCase().split(''),
  )
  const [isAnimating, setIsAnimating] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  // Refs to keep the animation loop stable (avoids re-creating the interval
  // on every frame when displayChars changes)
  const displayCharsRef = useRef(displayChars)
  const reducedMotionRef = useRef(reducedMotion)
  const rafRef = useRef<number | null>(null)

  // Keep refs in sync
  displayCharsRef.current = displayChars
  reducedMotionRef.current = reducedMotion

  // Mark as mounted after hydration, so SSR + first client render match
  // (AnimatePresence can produce different DOM during SSR vs client)
  useEffect(() => {
    setMounted(true)
  }, [])

  // Detect prefers-reduced-motion
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const animateFlip = useCallback(
    (target: string) => {
      if (reducedMotionRef.current) {
        setDisplayChars(target.toUpperCase().split(''))
        return
      }

      setIsAnimating(true)
      const targetChars = target.toUpperCase().split('')
      const current = [...displayCharsRef.current]
      const maxLen = Math.max(current.length, targetChars.length)
      // Pad shorter array with spaces
      while (current.length < maxLen) current.push(' ')
      while (targetChars.length < maxLen) targetChars.push(' ')

      let step = 0
      const charProgress = current.map((ch, i) => {
        const fromIdx = FLAP_CHARS.indexOf(ch) >= 0 ? FLAP_CHARS.indexOf(ch) : 0
        const toIdx =
          FLAP_CHARS.indexOf(targetChars[i]!) >= 0
            ? FLAP_CHARS.indexOf(targetChars[i]!)
            : 0
        const dist =
          toIdx >= fromIdx ? toIdx - fromIdx : FLAP_CHARS.length - fromIdx + toIdx
        return { fromIdx, toIdx, dist, currentIdx: fromIdx }
      })

      const maxDist = Math.max(...charProgress.map((p) => p.dist), 1)

      const tick = () => {
        step++
        let allDone = true
        const next = [...current]

        for (let i = 0; i < charProgress.length; i++) {
          const p = charProgress[i]!
          if (p.dist === 0) {
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
    [staggerDelay], // ← only depends on staggerDelay, not displayChars
  )

  // Cycle through messages
  useEffect(() => {
    if (messages.length <= 1) {
      if (messages[0]) animateFlip(messages[0])
      return
    }

    let currentMsgIndex = 0
    let timeoutRef: ReturnType<typeof setTimeout> | null = null

    const scheduleNext = () => {
      const nextIndex = (currentMsgIndex + 1) % messages.length
      const delay =
        lastMessageDuration && currentMsgIndex === messages.length - 1
          ? lastMessageDuration
          : interval

      timeoutRef = setTimeout(() => {
        currentMsgIndex = nextIndex
        setMsgIndex(currentMsgIndex)
        animateFlip(messages[currentMsgIndex]!)
        scheduleNext()
      }, delay)
    }

    // Kick off: show first message, then schedule the next
    animateFlip(messages[currentMsgIndex]!)
    scheduleNext()

    return () => {
      if (timeoutRef) clearTimeout(timeoutRef)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, interval, lastMessageDuration, animateFlip])

  // Determine if the current message is the "last" (CTA) one
  const isLastMessage = msgIndex === messages.length - 1
  const isLastMessageCTA = isLastMessage && lastMessageUrl

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
      {mounted ? (
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
              {char === ' ' ? (
                <span style={{ display: 'inline-block', width: '0.3em' }} />
              ) : isLastMessageCTA ? (
                <a
                  href={lastMessageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: 'inherit',
                    textDecoration: 'none',
                    borderBottom: '1px solid transparent',
                    transition: 'border-color 0.2s ease',
                  }}
                  className="text-flip-link"
                  onClick={(e) => e.stopPropagation()}
                >
                  {char}
                </a>
              ) : (
                char
              )}
            </motion.span>
          ))}
        </AnimatePresence>
      ) : (
        /* Static SSR-safe render — matches what the server produces */
        <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '0.08em' }}>
          {displayChars.map((char, i) => (
            <span
              key={i}
              style={{
                display: 'inline-block',
                fontFamily: '"Bebas Neue", "SF Pro Display", sans-serif',
                fontWeight: 600,
                letterSpacing: '0.02em',
                minWidth: '0.08em',
                textAlign: 'center',
                color: 'inherit',
                background: 'rgba(255,255,255,0.04)',
                borderRadius: '4px',
                padding: '0 0.04em',
                lineHeight: 1.15,
              }}
            >
              {char === ' ' ? ' ' : char}
            </span>
          ))}
        </span>
      )}
    </div>
  )
}