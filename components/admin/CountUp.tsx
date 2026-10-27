'use client'

/**
 * CountUp — rolls a figure from 0 up to its real value once, e.g. "HK$1,080" or "4".
 * The text it ends on is always the exact original string, so the animation can never show a
 * wrong final number. Skipped entirely under prefers-reduced-motion, and for anything that
 * is not a plain number (dashes, words).
 */

import { useEffect, useState } from 'react'

const NUM_RE = /^([^\d-]*)(-?\d[\d,]*(?:\.\d+)?)(.*)$/
const DURATION_MS = 700

export default function CountUp({ text }: { text: string }) {
  const [shown, setShown] = useState(text)

  useEffect(() => {
    setShown(text)
    const m = NUM_RE.exec(text)
    if (!m) return
    const target = Number(m[2].replace(/,/g, ''))
    if (!Number.isFinite(target) || target === 0) return
    if (typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const decimals = m[2].includes('.') ? m[2].split('.')[1].length : 0
    const grouped = m[2].includes(',')
    const fmt = (n: number) =>
      n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: grouped })

    let frame = 0
    const start = performance.now()
    setShown(`${m[1]}${fmt(0)}${m[3]}`)
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION_MS)
      if (t >= 1) {
        setShown(text) // always land on the exact original text
        return
      }
      const eased = 1 - Math.pow(1 - t, 3)
      setShown(`${m[1]}${fmt(target * eased)}${m[3]}`)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [text])

  return <>{shown}</>
}
