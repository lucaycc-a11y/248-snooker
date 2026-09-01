/**
 * ConicSpinner — rotating conic-gradient loading indicator.
 *
 * Used for AI processing states and general async loading.
 * Renders a green gradient ring that spins smoothly.
 * Respects `prefers-reduced-motion` via the CSS class `admin-conic-spinner`.
 */

import { type HTMLAttributes } from 'react'

type ConicSpinnerProps = HTMLAttributes<HTMLDivElement> & {
  /** Spinner size in pixels. Default: 20. */
  size?: number
}

export function ConicSpinner({ size = 20, className, ...rest }: ConicSpinnerProps) {
  return (
    <div
      className={`admin-conic-spinner ${className ?? ''}`}
      style={{ width: size, height: size }}
      role="status"
      aria-label="Loading"
      {...rest}
    />
  )
}

export default ConicSpinner
