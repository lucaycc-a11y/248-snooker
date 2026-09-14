'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatVersion } from '@/lib/version'

export function MaintenanceBadge() {
  const router = useRouter()
  const [show, setShow] = useState(false)

  useEffect(() => {
    // Only show if gate is enabled and user has bypassed it
    fetch('/api/gate/status')
      .then((res) => res.json())
      .then((data) => {
        setShow(data.enabled && data.bypassed)
      })
      .catch(() => setShow(false))
  }, [])

  if (!show) return null

  return (
    <button
      onClick={() => router.push('/admin/dev2?tab=deploy')}
      style={{
        position: 'fixed',
        bottom: 16,
        left: 16,
        zIndex: 9999,
        padding: '6px 12px',
        background: 'rgba(255, 136, 0, 0.9)',
        color: '#000',
        fontFamily: 'monospace',
        fontSize: 12,
        fontWeight: 700,
        borderRadius: 4,
        border: 'none',
        cursor: 'pointer',
        userSelect: 'none',
      }}
    >
      MAINTENANCE MODE · {formatVersion()}
    </button>
  )
}
