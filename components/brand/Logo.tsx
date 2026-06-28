import Image from 'next/image'

type LogoProps = {
  variant?: 'full' | 'mark'
  /** Background the logo sits on — picks the white-on-dark vs black-on-light artwork. */
  theme?: 'dark' | 'light'
  size?: number
}

export function Logo({ variant = 'full', theme = 'dark', size = 48 }: LogoProps) {
  const src =
    variant === 'mark'
      ? theme === 'dark'
        ? '/logos/248_ball_white.svg'
        : '/logos/248_ball_black.svg'
      : theme === 'dark'
      ? '/logos/248_logo_dark_bg.svg'
      : '/logos/248_logo_white_bg.svg'

  // Marks are square; the full lockup is wider than tall.
  const width = variant === 'mark' ? size : Math.round(size * 2.8)

  return (
    <Image
      src={src}
      alt="248 Snooker Club"
      width={width}
      height={size}
      style={{ height: size, width: 'auto' }}
      priority
    />
  )
}
