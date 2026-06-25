export const tokens = {
  colors: {
    bg: '#000000',
    surface: '#111111',
    surfaceElevated: '#1A1A1A',
    border: 'rgba(255,255,255,0.1)',
    borderStrong: 'rgba(255,255,255,0.18)',
    text: '#FFFFFF',
    textMuted: 'rgba(255,255,255,0.45)',
    textFaint: 'rgba(255,255,255,0.25)',
    brand: '#25D366',
    brandHover: '#1FB855',
    brandDim: 'rgba(37,211,102,0.12)',
    brandText: '#000000',
    link: '#0071E3',
    danger: '#FF453A',
  },
  radius: {
    input: '12px',
    button: '14px',
    card: '20px',
    pill: '999px',
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    base: '16px',
    lg: '24px',
    xl: '32px',
    '2xl': '48px',
    '3xl': '64px',
    '4xl': '96px',
  },
  font: {
    sans: 'system-ui, -apple-system, "SF Pro Text", sans-serif',
    display: '"Bebas Neue", sans-serif',
  },
  easing: {
    spring: 'cubic-bezier(0.16,1,0.3,1)',
    standard: 'cubic-bezier(0.4,0,0.2,1)',
  },
  duration: {
    fast: '150ms',
    base: '250ms',
    slow: '380ms',
  },
  breakpoint: {
    mobile: 768,
  },
} as const

export type Tokens = typeof tokens
