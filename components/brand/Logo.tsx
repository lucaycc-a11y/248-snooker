import Image from 'next/image'

type LogoProps = {
  variant?: 'full' | 'mark'
  /** Background the logo sits on — picks the white-on-dark vs black-on-light artwork. */
  theme?: 'dark' | 'light'
  size?: number
}

export function Logo({ variant = 'full', theme = 'dark', size = 48 }: LogoProps) {
  // Official SVG exports — white artwork for dark sections, black artwork for
  // light sections. The 8-ball is part of the logo artwork itself; never
  // redraw it in code.
  const src =
    variant === 'mark'
      ? theme === 'dark'
        ? '/logos/space8_badge_white.svg'
        : '/logos/space8_badge_black.svg'
      : theme === 'dark'
        ? '/logos/space8_wordmark_white.svg'
        : '/logos/space8_wordmark_black.svg'

  // Marks are square (1080×1080); the full lockup is 1560.86×500.
  // Brand guideline v1.0 hard rule: never render the logo narrower than
  // 120px (digital minimum) — clamp the height so the width stays ≥120px.
  const MIN_WIDTH = 120
  const ratio = variant === 'mark' ? 1 : 3.12
  const minHeight = Math.ceil(MIN_WIDTH / ratio)
  const height = Math.max(size, minHeight)
  const width = Math.round(height * ratio)

  return (
    <Image
      src={src}
      alt="Space8"
      width={width}
      height={height}
      style={{
        height,
        width: 'auto',
      }}
      priority
    />
  )
}
