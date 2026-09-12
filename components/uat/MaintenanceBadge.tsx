'use client'

// Maintenance badge for production domain during internal review
// Only renders when site_gate_config.enabled=true AND request passed the gate

import { useEffect, useState } from 'react'
import { Dev2Panel } from './Dev2Panel'

type GateStatus = {
  enabled: boolean
  isWhitelisted: boolean
  hasBypass: boolean
}

export function MaintenanceBadge() {
  const [isOpen, setIsOpen] = useState(false)
  const [gateStatus, setGateStatus] = useState<GateStatus | null>(null)

  useEffect(() => {
    // Only fetch on production domain (not UAT)
    if (process.env.NEXT_PUBLIC_APP_ENV === 'uat') return

    fetch('/api/maintenance/gate-status')
      .then((res) => res.json())
      .then((data) => setGateStatus(data))
      .catch(() => setGateStatus(null))
  }, [])

  // Don't render if:
  // - Still loading
  // - Gate is disabled (site is public)
  // - User hasn't passed the gate (shouldn't see this on coming-soon page)
  if (!gateStatus || !gateStatus.enabled) return null
  if (!gateStatus.isWhitelisted && !gateStatus.hasBypass) return null

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'fixed',
          bottom: '16px',
          left: '16px',
          zIndex: 9999,
          backgroundColor: 'rgba(244, 67, 54, 0.95)',
          color: '#fff',
          padding: '8px 16px',
          borderRadius: '4px',
          fontFamily: 'var(--font-good-times, system-ui)',
          fontSize: '14px',
          fontWeight: 'bold',
          letterSpacing: '0.5px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
          userSelect: 'none',
          border: 'none',
          cursor: 'pointer',
        }}
        aria-label="Maintenance Mode - Internal Review - Open Debug Panel"
      >
        MAINTENANCE — INTERNAL REVIEW
      </button>

      {isOpen && (
        <>
          {/* Click-outside overlay */}
          <div
            onClick={() => setIsOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9998,
            }}
          />
          <Dev2Panel mode="production-review" />
        </>
      )}
    </>
  )
}
