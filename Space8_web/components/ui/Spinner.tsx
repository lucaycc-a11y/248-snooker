import { tokens } from '@/app/styles/tokens'

type SpinnerProps = {
  size?: number
}

export function Spinner({ size = 40 }: SpinnerProps) {
  const ballSize = size * 0.4
  const ringSize = size

  return (
    <div
      style={{
        position: 'relative',
        width: ringSize,
        height: ringSize,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* 8-ball center */}
      <div
        style={{
          width: ballSize,
          height: ballSize,
          borderRadius: '50%',
          backgroundColor: tokens.colors.text,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: ballSize * 0.5,
          fontWeight: 700,
          color: tokens.colors.bg,
          lineHeight: 1,
        }}
      >
        8
      </div>
      {/* Orbiting ring */}
      <svg
        width={ringSize}
        height={ringSize}
        viewBox={`0 0 ${ringSize} ${ringSize}`}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          animation: 'spin 1.2s linear infinite',
        }}
      >
        <circle
          cx={ringSize / 2}
          cy={ringSize / 2}
          r={ringSize / 2 - 2}
          fill="none"
          stroke={tokens.colors.text}
          strokeWidth="2"
          strokeDasharray={`${ringSize * 0.6} ${ringSize * 2}`}
          strokeLinecap="round"
        />
      </svg>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
