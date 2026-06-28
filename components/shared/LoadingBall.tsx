'use client'

import Image from 'next/image'

/**
 * Full-screen black overlay with the 8-ball rolling left↔right.
 * Used directly as Next.js app/loading.tsx and reusable anywhere a
 * blocking loader is needed.
 */
export default function LoadingBall() {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#000000',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
    >
      <style>{`
        @keyframes roll {
          0% { transform: translateX(-60px) rotate(0deg); }
          50% { transform: translateX(60px) rotate(360deg); }
          100% { transform: translateX(-60px) rotate(720deg); }
        }
        @keyframes shadow {
          0%, 100% { transform: translateX(-50%) scaleX(0.6); opacity: 0.3; }
          50% { transform: translateX(-50%) scaleX(1); opacity: 0.15; }
        }
      `}</style>

      <div style={{ position: 'relative', width: 140, height: 80 }}>
        <div
          style={{
            animation: 'roll 1.4s ease-in-out infinite',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Image
            src="/logos/248_ball_white.svg"
            alt="Loading"
            width={56}
            height={56}
            priority
          />
        </div>

        <div
          style={{
            position: 'absolute',
            bottom: -8,
            left: '50%',
            width: 40,
            height: 8,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.15)',
            animation: 'shadow 1.4s ease-in-out infinite',
          }}
        />
      </div>
    </div>
  )
}
