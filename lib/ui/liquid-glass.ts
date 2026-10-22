import type { CSSProperties } from 'react'

export type GlassTheme = 'dark' | 'light'

// Plain frosted blur: translucent fill + backdrop blur + thin border.
// (File name kept so existing imports keep working.)
const BLUR = 'blur(20px) saturate(160%)'

/** Frosted surface for pills / round buttons (nav bar, avatar). */
export function liquidGlass(theme: GlassTheme): CSSProperties {
  const dark = theme === 'dark'
  return {
    background: dark ? 'rgba(30,32,36,0.45)' : 'rgba(255,255,255,0.65)',
    backdropFilter: BLUR,
    WebkitBackdropFilter: BLUR,
    border: `1px solid ${dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'}`,
    boxShadow: 'none',
  }
}

/** Frosted panel for menus whose text is always light: a dark tint keeps it
 *  readable over light pages. */
export function liquidGlassMenu(): CSSProperties {
  return {
    background: 'rgba(28,30,34,0.62)',
    backdropFilter: BLUR,
    WebkitBackdropFilter: BLUR,
    border: '1px solid rgba(255,255,255,0.12)',
    boxShadow: 'none',
  }
}
