'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Maintenance Badge - shown bottom-left when:
 * - site_gate_config.enabled = true
 * - AND viewer has already bypassed the gate (whitelist or password)
 *
 * Tapping opens the dev2 panel (Deploy tab front-and-center)
 */
export function MaintenanceBadge() {
  const [show, setShow] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // Check if gate is enabled and we're viewing the site (bypassed)
    // This is indicated by being able to see this page at all
    fetch('/api/dev2/env-info', { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        // Only show badge if gate is enabled and we're an admin who bypassed it
        setShow(data.gateEnabled && data.admin)
      })
      .catch(() => setShow(false))
  }, [])

  if (!show) return null

  return (
    <div
      onClick={() => router.push('/admin/dev2?tab=deploy')}
      style={{
        position: 'fixed',
        bottom: 16,
        left: 16,
        zIndex: 9998,
        padding: '8px 14px',
        background: 'rgba(255, 136, 0, 0.95)',
        color: '#000',
        fontFamily: 'monospace',
        fontSize: 13,
        fontWeight: 700,
        borderRadius: 6,
        cursor: 'pointer',
        userSelect: 'none',
        border: '2px solid #ff8800',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      }}
      title="Maintenance mode active - Click to open Dev2 panel"
    >
      🔧 MAINTENANCE
    </div>
  )
}
