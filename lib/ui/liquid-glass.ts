import type { CSSProperties } from 'react'

export type GlassTheme = 'dark' | 'light'

// Frosted glass (file name kept so existing imports keep working): a calm
// translucent fill, strong blur with a little saturation so colours behind
// stay lively, a hairline border plus a 1px top highlight for edge definition,
// and a soft drop shadow to lift it off the page. No prism / rim effects.
const BLUR = 'blur(24px) saturate(170%)'

/** Frosted surface for pills / round buttons (nav bar, avatar). */
export function liquidGlass(theme: GlassTheme): CSSProperties {
  const dark = theme === 'dark'
  return {
    background: dark ? 'rgba(28,30,36,0.48)' : 'rgba(255,255,255,0.62)',
    backdropFilter: BLUR,
    WebkitBackdropFilter: BLUR,
    border: `1px solid ${dark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.75)'}`,
    boxShadow: dark
      ? 'inset 0 1px 0 rgba(255,255,255,0.16), 0 6px 24px rgba(0,0,0,0.32)'
      : 'inset 0 1px 0 rgba(255,255,255,0.9), 0 6px 24px rgba(30,40,60,0.12)',
  }
}

/** Frosted panel for menus whose text is always light: a dark tint keeps it
 *  readable over light pages. */
export function liquidGlassMenu(): CSSProperties {
  return {
    background: 'rgba(26,28,34,0.66)',
    backdropFilter: BLUR,
    WebkitBackdropFilter: BLUR,
    border: '1px solid rgba(255,255,255,0.14)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.14), 0 14px 40px rgba(0,0,0,0.4)',
  }
}
