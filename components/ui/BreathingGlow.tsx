/**
 * BreathingGlow — pulsing glow wrapper for pending action cards.
 *
 * Wraps children in a container that gently scales and changes opacity
 * to draw attention to items that need admin confirmation.
 * Respects `prefers-reduced-motion` via the CSS class `admin-breathing-glow`.
 */

import { type HTMLAttributes } from 'react'

type BreathingGlowProps = HTMLAttributes<HTMLDivElement>

export function BreathingGlow({ className, children, ...rest }: BreathingGlowProps) {
  return (
    <div
      className={`admin-breathing-glow ${className ?? ''}`}
      {...rest}
    >
      {children}
    </div>
  )
}

export default BreathingGlow
