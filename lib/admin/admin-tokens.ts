/**
 * Admin-only design tokens.
 *
 * Same shape as app/styles/tokens.ts (which the public site shares and must not
 * change), but every colour resolves through the --admin-* CSS variables, so
 * admin pages follow the dark/light theme and the liquid-glass skin instead of
 * carrying fixed dark-mode hex values. Admin code imports this as `tokens`.
 */
export const adminTokens = {
  colors: {
    bg: 'var(--admin-bg-primary)',
    surface: 'var(--admin-bg-surface)',
    surfaceElevated: 'var(--admin-bg-elevated)',
    border: 'var(--admin-border-subtle)',
    borderStrong: 'var(--admin-border-strong)',
    text: 'var(--admin-text-primary)',
    textMuted: 'var(--admin-text-secondary)',
    textFaint: 'var(--admin-text-tertiary)',
    brand: 'var(--admin-green)',
    brandHover: 'var(--admin-green-bright)',
    brandDim: 'var(--admin-accent-soft)',
    brandText: 'var(--admin-brand-text)',
    link: 'var(--admin-green)',
    danger: 'var(--admin-status-danger)',
  },
  radius: {
    input: 'var(--admin-radius-input)',
    button: 'var(--admin-radius-button)',
    card: 'var(--admin-radius-card)',
    pill: 'var(--admin-radius-pill)',
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    base: '16px',
    lg: '24px',
    xl: '32px',
  },
  font: {
    sans: 'var(--admin-font-sans)',
  },
} as const
