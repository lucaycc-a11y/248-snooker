/**
 * Spark (Beta) — Typing Indicator Component
 * Shows loading state with accessibility support (reduced motion)
 */

'use client'

import { useState, useEffect } from 'react'

export function TypingIndicator() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(mediaQuery.matches)

    const listener = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches)
    mediaQuery.addEventListener('change', listener)

    return () => mediaQuery.removeEventListener('change', listener)
  }, [])

  if (prefersReducedMotion) {
    // Static ellipsis for reduced motion users
    return (
      <div className="flex items-center gap-1 px-4 py-2">
        <span className="text-neutral-600 dark:text-neutral-400">···</span>
      </div>
    )
  }

  // Animated dots (staggered pulse)
  return (
    <div className="flex items-center gap-1 px-4 py-2">
      <span className="h-2 w-2 animate-pulse rounded-full bg-neutral-400" style={{ animationDelay: '0s' }} />
      <span className="h-2 w-2 animate-pulse rounded-full bg-neutral-400" style={{ animationDelay: '0.2s' }} />
      <span className="h-2 w-2 animate-pulse rounded-full bg-neutral-400" style={{ animationDelay: '0.4s' }} />
    </div>
  )
}
