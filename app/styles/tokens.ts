export const tokens = {
  colors: {
    bg: '#000000',
    surface: '#111111',
    surfaceElevated: '#1A1A1A',
    border: 'rgba(255,255,255,0.1)',
    borderStrong: 'rgba(255,255,255,0.18)',
    text: '#FFFFFF',
    // Raised from 0.45/0.25 — the old values rendered secondary text nearly
    // invisible on pure black (reported readability bug on /book). Keep
    // muted ≥0.62 and faint ≥0.42 for WCAG-ish contrast on #000.
    textMuted: 'rgba(255,255,255,0.62)',
    textFaint: 'rgba(255,255,255,0.42)',
    brand: '#25D366',
    brandHover: '#1FB855',
    brandDim: 'rgba(37,211,102,0.12)',
    brandText: '#000000',
    link: '#22c55e',
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
  // Liquid Glass recipes — consolidates what was previously ~8 distinct
  // inline backdropFilter values scattered across Nav/Sheet/MemberDashboard/
  // AIChatWidget/AdminSidebar into named tiers. `surface` matches the
  // membership card's original GLASS_BLUR; `prominent` matches Nav/AdminSidebar.
  glass: {
    overlay: 'blur(8px)',
    subtle: 'blur(12px) saturate(150%)',
    surface: 'blur(20px) saturate(180%)',
    prominent: 'blur(24px) saturate(180%)',
  },
  glassBg: {
    dark: 'rgba(255,255,255,0.05)',
    border: 'rgba(255,255,255,0.18)',
  },
} as const

export type Tokens = typeof tokens
