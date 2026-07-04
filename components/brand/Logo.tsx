import Image from 'next/image'

type LogoProps = {
  variant?: 'full' | 'mark'
  /** Background the logo sits on — picks the white-on-dark vs black-on-light artwork. */
  theme?: 'dark' | 'light'
  size?: number
}

export function Logo({ variant = 'full', theme = 'dark', size = 48 }: LogoProps) {
  // Space8_full_icon_black_white_bkg.svg is the only logo asset that's a real
  // transparent vector (plain black <path> fills, no background). The three
  // "_white_black_bkg"/ball_icon variants are raster exports with an opaque
  // black background baked in (no alpha channel) — using them renders as a
  // solid black box on dark sections. So the full lockup always loads that one
  // clean file and gets inverted to white via CSS filter for the dark theme;
  // it stays untouched (black-on-transparent) for the light theme.
  const src =
    variant === 'mark'
      ? theme === 'dark'
        ? '/logos/Space8_ball_icon_white_black_bkg.svg'
        : '/logos/Space8_ball_icon_black_white_bkg.svg'
      : '/logos/Space8_full_icon_black_white_bkg.svg'

  // Marks are square; the full lockup is wider than tall.
  const width = variant === 'mark' ? size : Math.round(size * 2.8)

  return (
    <Image
      src={src}
      alt="Space8"
      width={width}
      height={size}
      style={{
        height: size,
        width: 'auto',
        filter: variant === 'full' && theme === 'dark' ? 'invert(1)' : undefined,
      }}
      priority
    />
  )
}
