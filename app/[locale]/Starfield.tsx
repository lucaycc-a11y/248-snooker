// Lightweight CSS-only starfield — a handful of radial-gradient "dots" at
// varying size/opacity, tiled via background-repeat. No canvas/JS cost (pure
// CSS), sits behind the snooker table as a subtle sci-fi backdrop rather than
// a full space scene. Used by app/not-found.tsx and app/error.tsx.
export function Starfield() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 opacity-70"
      style={{
        backgroundImage: [
          'radial-gradient(1.6px 1.6px at 12% 18%, rgba(255,255,255,0.85), transparent)',
          'radial-gradient(1.2px 1.2px at 28% 62%, rgba(255,255,255,0.6), transparent)',
          'radial-gradient(1.8px 1.8px at 44% 8%, rgba(255,255,255,0.75), transparent)',
          'radial-gradient(1.2px 1.2px at 63% 44%, rgba(255,255,255,0.5), transparent)',
          'radial-gradient(1.5px 1.5px at 78% 22%, rgba(167,139,250,0.7), transparent)',
          'radial-gradient(1.2px 1.2px at 88% 68%, rgba(255,255,255,0.55), transparent)',
          'radial-gradient(1.6px 1.6px at 8% 78%, rgba(255,255,255,0.6), transparent)',
          'radial-gradient(1.3px 1.3px at 52% 88%, rgba(167,139,250,0.55), transparent)',
          'radial-gradient(1.4px 1.4px at 96% 40%, rgba(255,255,255,0.65), transparent)',
          'radial-gradient(1.2px 1.2px at 35% 32%, rgba(255,255,255,0.45), transparent)',
        ].join(', '),
        backgroundRepeat: 'repeat',
        backgroundSize: '520px 520px',
      }}
    />
  )
}
