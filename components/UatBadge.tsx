'use client'

// UAT environment badge - displays in the bottom-left corner when on
// uat.space8.com.hk to clearly distinguish test from production.
//
// Only renders on client-side after hydration to avoid hostname detection
// issues during SSR. Uses Good Times font per requirements (or fallback if
// not available).

import { useEffect, useState } from 'react'

export function UatBadge() {
  const [isUat, setIsUat] = useState(false)

  useEffect(() => {
    // Client-only hostname check — SSR doesn't have access to window.location
    setIsUat(window.location.hostname === 'uat.space8.com.hk')
  }, [])

  if (!isUat) return null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '16px',
        left: '16px',
        zIndex: 9999,
        pointerEvents: 'none',
        backgroundColor: 'rgba(255, 165, 0, 0.95)',
        color: '#000',
        padding: '8px 16px',
        borderRadius: '4px',
        fontFamily: 'var(--font-good-times, system-ui)',
        fontSize: '14px',
        fontWeight: 'bold',
        letterSpacing: '0.5px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
        userSelect: 'none',
      }}
      role="status"
      aria-label="UAT Testing Environment"
    >
      UAT TEST
    </div>
  )
}
