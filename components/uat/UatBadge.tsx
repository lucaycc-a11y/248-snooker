'use client'

import { useState } from 'react'
import { formatVersion } from '@/lib/version'
import { Dev2Panel } from './Dev2Panel'

export function UatBadge() {
  const [showPanel, setShowPanel] = useState(false)

  if (process.env.NEXT_PUBLIC_APP_ENV !== 'uat') {
    return null
  }

  return (
    <>
      <button
        onClick={() => setShowPanel(true)}
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
          border: 'none',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        UAT TEST · {formatVersion()}
      </button>

      {showPanel && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowPanel(false)
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            background: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <div
            style={{
              background: 'var(--admin-bg)',
              borderRadius: 12,
              maxWidth: 1400,
              width: '100%',
              maxHeight: '90vh',
              overflow: 'auto',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
            }}
          >
            <Dev2Panel onClose={() => setShowPanel(false)} />
          </div>
        </div>
      )}
    </>
  )
}
