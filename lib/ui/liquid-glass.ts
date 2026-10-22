import type { CSSProperties } from 'react'

export type GlassTheme = 'dark' | 'light'

// iOS-26-style liquid glass: a nearly clear body that refracts what is behind
// it, a bright specular rim (strongest top-left, softer bottom-right), and
// faint prismatic fringes (pink / amber / blue) bleeding in from the edges.
const BLUR = 'blur(14px) saturate(200%) brightness(1.06)'

const PRISM = [
  'radial-gradient(130% 150% at 12% 0%, rgba(255,255,255,0.34) 0%, rgba(255,255,255,0) 46%)',
  'radial-gradient(70% 120% at 100% 100%, rgba(255,170,215,0.26) 0%, rgba(255,170,215,0) 62%)',
  'radial-gradient(60% 110% at 100% 0%, rgba(255,226,150,0.20) 0%, rgba(255,226,150,0) 60%)',
  'radial-gradient(70% 120% at 0% 100%, rgba(140,195,255,0.22) 0%, rgba(140,195,255,0) 62%)',
]

const RIM = [
  'inset 0 0 0 1px rgba(255,255,255,0.38)',
  'inset 2px 2px 3px -1px rgba(255,255,255,0.75)',
  'inset -2px -2px 3px -1px rgba(255,255,255,0.5)',
  'inset 0 0 14px rgba(255,255,255,0.14)',
  'inset 0 -7px 14px -6px rgba(150,170,255,0.22)',
]

/** Liquid-glass surface for pills / round buttons (nav bar, avatar). */
export function liquidGlass(theme: GlassTheme): CSSProperties {
  const dark = theme === 'dark'
  return {
    background: [
      ...PRISM,
      dark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.45)',
    ].join(', '),
    backdropFilter: BLUR,
    WebkitBackdropFilter: BLUR,
    border: 'none',
    boxShadow: [
      ...RIM,
      dark ? '0 8px 28px rgba(0,0,0,0.38)' : '0 8px 28px rgba(40,50,70,0.16)',
    ].join(', '),
  }
}

/** Liquid-glass panel for menus whose text is always light: a smoked tint
 *  under the same prismatic rim keeps it readable over light pages. */
export function liquidGlassMenu(): CSSProperties {
  return {
    background: [...PRISM, 'rgba(24,26,32,0.58)'].join(', '),
    backdropFilter: BLUR,
    WebkitBackdropFilter: BLUR,
    border: 'none',
    boxShadow: [...RIM, '0 16px 48px rgba(0,0,0,0.42)'].join(', '),
  }
}
