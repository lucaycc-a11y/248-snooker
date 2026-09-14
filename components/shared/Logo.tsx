/**
 * Logo — Space8 logo components using real SVG assets from /public/logos/.
 *
 * Automatically picks the correct variant based on theme context:
 * - Dark mode: white logos
 * - Light mode: black logos
 *
 * §1.7 spec: 44px minimum tap target on mobile.
 */

import { type ImgHTMLAttributes } from 'react'

type LogoVariant = 'horizontal' | 'mark' | 'square' | 'horizontal-mark'

type LogoProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt'> & {
  /** Logo variant to render. */
  variant?: LogoVariant
  /** Force a specific color scheme, overriding auto-detection. */
  theme?: 'dark' | 'light'
}

/**
 * Resolves the correct logo file path based on variant and theme.
 * Admin dark mode → white logos; admin light mode → black logos.
 */
function getLogoSrc(variant: LogoVariant, theme: 'dark' | 'light'): string {
  const isDark = theme === 'dark'

  switch (variant) {
    case 'horizontal':
      return isDark
        ? '/logos/logo-white-horizontal.svg'
        : '/logos/logo-black-horizontal.svg'
    case 'mark':
      // Only white mark SVG exists; for light mode, use the dark horizontal
      // (mark-only not available in dark variant — use square as fallback)
      return '/logos/logo-white-mark.svg'
    case 'square':
      return isDark
        ? '/logos/logo-white-square.svg'
        : '/logos/logo-black-square.svg'
    case 'horizontal-mark':
      return isDark
        ? '/logos/logo-black-white8-horizontal.svg'
        : '/logos/logo-black-white8-horizontal.svg'
    default:
      return isDark
        ? '/logos/logo-white-horizontal.svg'
        : '/logos/logo-black-horizontal.svg'
  }
}

/**
 * Logo — renders the Space8 logo as an <img> referencing the SVG files
 * in /public/logos/. Uses CSS to control sizing; defaults to h-8 width auto.
 */
export function Logo({
  variant = 'horizontal',
  theme,
  className,
  style,
  width,
  height,
  ...rest
}: LogoProps) {
  // When no theme is forced, default to dark (admin default theme).
  // The CSS `filter: invert(1)` trick handles light mode if theme is not set,
  // but explicit theme prop is preferred.
  const resolvedTheme = theme ?? 'dark'
  const src = getLogoSrc(variant, resolvedTheme)

  return (
    <img
      src={src}
      alt="Space8"
      className={className ?? 'h-8 w-auto'}
      style={style}
      width={width}
      height={height}
      draggable={false}
      {...rest}
    />
  )
}

/**
 * LogoMark — compact icon-only variant for collapsed sidebar / mobile tab bar.
 * Only a white mark SVG exists in /public/logos/, so light mode applies a
 * CSS invert filter to render it dark. Wrapped in a 44px min touch target
 * (§1.7 spec).
 */
export function LogoMark({
  theme,
  className,
  size = 24,
  ...rest
}: Omit<LogoProps, 'variant'> & { size?: number }) {
  const resolvedTheme = theme ?? 'dark'
  return (
    <span
      className={`inline-flex items-center justify-center min-w-[44px] min-h-[44px] ${className ?? ''}`}
    >
      <img
        src="/logos/logo-white-mark.svg"
        alt="Space8"
        width={size}
        height={size}
        className="w-auto"
        style={resolvedTheme === 'light' ? { filter: 'invert(1)' } : undefined}
        draggable={false}
        {...rest}
      />
    </span>
  )
}

export default Logo
