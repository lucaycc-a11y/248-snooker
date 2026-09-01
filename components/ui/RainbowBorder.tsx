/**
 * RainbowBorder — micro-glow rainbow border for focus states.
 *
 * Wraps children in a container that shows a rotating rainbow gradient
 * border on focus-within. Used on search bars and interactive containers.
 * Respects `prefers-reduced-motion` via the CSS class `admin-rainbow-border`.
 */

import { type HTMLAttributes } from 'react'

type RainbowBorderProps = HTMLAttributes<HTMLDivElement>

export function RainbowBorder({ className, children, ...rest }: RainbowBorderProps) {
  return (
    <div
      className={`admin-rainbow-border rounded-2xl ${className ?? ''}`}
      {...rest}
    >
      {children}
    </div>
  )
}

export default RainbowBorder
