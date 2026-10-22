import type { CSSProperties } from 'react'

export type GlassTheme = 'dark' | 'light'

const BLUR = 'blur(22px) saturate(180%) brightness(1.08)'

/** Liquid-glass surface for pills / round buttons (nav bar, avatar). */
export function liquidGlass(theme: GlassTheme): CSSProperties {
  const dark = theme === 'dark'
  return {
    background: dark
      ? 'linear-gradient(180deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.05) 45%, rgba(255,255,255,0.09) 100%)'
      : 'linear-gradient(180deg, rgba(255,255,255,0.78) 0%, rgba(255,255,255,0.5) 100%)',
    backdropFilter: BLUR,
    WebkitBackdropFilter: BLUR,
    border: `1px solid ${dark ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.7)'}`,
    boxShadow: dark
      ? 'inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -1px 0 rgba(255,255,255,0.06), inset 0 0 18px rgba(255,255,255,0.05), 0 8px 32px rgba(0,0,0,0.35)'
      : 'inset 0 1px 0 rgba(255,255,255,0.9), inset 0 0 18px rgba(255,255,255,0.35), 0 8px 32px rgba(0,0,0,0.12)',
  }
}

/** Liquid-glass panel for menus whose text is always light: a smoked tint
 *  keeps it readable over light pages while still refracting what is behind. */
export function liquidGlassMenu(): CSSProperties {
  return {
    background:
      'linear-gradient(180deg, rgba(60,64,72,0.62) 0%, rgba(24,26,30,0.58) 100%)',
    backdropFilter: BLUR,
    WebkitBackdropFilter: BLUR,
    border: '1px solid rgba(255,255,255,0.2)',
    boxShadow:
      'inset 0 1px 0 rgba(255,255,255,0.3), inset 0 0 18px rgba(255,255,255,0.05), 0 16px 48px rgba(0,0,0,0.4)',
  }
}
