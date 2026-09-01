/**
 * SparkleIcon — AI sparkle indicator.
 *
 * Small animated icon that signals "AI-generated" or "AI-assisted" content.
 * Respects `prefers-reduced-motion` via the CSS class `admin-sparkle`.
 */

import { Sparkles } from 'lucide-react'
import { type ComponentProps } from 'react'

type SparkleIconProps = ComponentProps<typeof Sparkles>

export function SparkleIcon({ size = 16, className, ...rest }: SparkleIconProps) {
  return (
    <span className={`admin-sparkle inline-flex ${className ?? ''}`}>
      <Sparkles
        size={size}
        strokeWidth={1.5}
        className="text-[var(--admin-brand)]"
        {...rest}
      />
    </span>
  )
}

export default SparkleIcon
