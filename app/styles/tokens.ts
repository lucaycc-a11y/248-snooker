export const tokens = {
  colors: {
    bg: '#14161A',
    surface: '#1A1C20',
    surfaceElevated: '#1F2126',
    border: 'rgba(255,255,255,0.1)',
    borderStrong: 'rgba(255,255,255,0.18)',
    text: '#FFFFFF',
    // On graphite (#14161A) white text sits at ~18.6:1 contrast — AAA-safe
    // for all sizes. Keep secondary text opaque enough that it never
    // disappears into the warmer grey base.
    textMuted: 'rgba(255,255,255,0.72)',
    textFaint: 'rgba(255,255,255,0.52)',
    brand: '#25D366',
    brandHover: '#1FB855',
    brandDim: 'rgba(37,211,102,0.12)',
    brandText: '#000000',
    link: '#22c55e',
    danger: '#FF453A',

    /** Admin green palette — §1.1 spec (NO blue anywhere). */
    green: {
      50: '#f0fdf4',
      100: '#dcfce7',
      200: '#bbf7d0',
      300: '#86efac',
      400: '#4ade80',
      500: '#22c55e',
      600: '#16a34a',
      700: '#15803d',
      800: '#166534',
      900: '#14532d',
      950: '#052e16',
    } as const,

    /**
     * Tonal depth system — lighter = raised, darker = recessed.
     * Use these instead of shadows for visual hierarchy on dark backgrounds.
     * Each step is a ~3% white overlay on graphite (#14161A).
     */
    depth: {
      /** Page background — matches colors.bg (graphite) */
      base: 'rgba(20,22,26,1)',
      /** Recessed surface — sunken inputs, grouped cells */
      recessed: 'rgba(255,255,255,0.02)',
      /** Default surface — standard containers */
      flat: 'rgba(255,255,255,0.035)',
      /** Raised surface — cards, sidebars */
      raised: 'rgba(255,255,255,0.05)',
      /** Elevated surface — active/focused cards */
      elevated: 'rgba(255,255,255,0.06)',
      /** Overlay surface — modals, popups */
      overlay: 'rgba(255,255,255,0.07)',
      /** Top layer — toast, dropdown */
      top: 'rgba(255,255,255,0.08)',
    },
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
    display: '"Good Times", "Bebas Neue", sans-serif',
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
