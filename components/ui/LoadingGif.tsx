'use client'

import { useState } from 'react'

/** Branded loading animation shared by route, booking, and auth loading states. */
export function LoadingGif({ size = 140 }: { size?: number }) {
  const clampedSize = Math.max(120, Math.min(160, size))
  const [videoFailed, setVideoFailed] = useState(false)

  return (
    <div
      role="status"
      aria-label="Loading"
      style={{
        width: clampedSize,
        height: clampedSize,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {videoFailed ? (
        <span
          aria-hidden="true"
          style={{
            width: clampedSize * 0.42,
            height: clampedSize * 0.42,
            border: `${Math.max(2, clampedSize / 28)}px solid rgba(255,255,255,0.25)`,
            borderTopColor: '#ffffff',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }}
        />
      ) : (
        <video
          autoPlay
          loop
          muted
          playsInline
          aria-label="Loading"
          onError={() => setVideoFailed(true)}
          style={{ width: clampedSize, height: clampedSize, objectFit: 'contain' }}
        >
          <source src="/video/Loading/space8_loading_transparent.webm" type="video/webm" />
        </video>
      )}
    </div>
  )
}
