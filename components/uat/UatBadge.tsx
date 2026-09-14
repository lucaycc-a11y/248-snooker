'use client'

import { formatVersion } from '@/lib/version'

export function UatBadge() {
  if (process.env.NEXT_PUBLIC_APP_ENV !== 'uat') {
    return null
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 16,
        left: 16,
        zIndex: 9999,
        padding: '6px 12px',
        background: 'rgba(234, 179, 8, 0.9)',
        color: '#000',
        fontFamily: 'monospace',
        fontSize: 12,
        fontWeight: 700,
        borderRadius: 4,
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    >
      UAT TEST · {formatVersion()}
    </div>
  )
}
