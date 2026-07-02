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
        ? '/logos/Space8_ball_icon_white_black_bkg.svg'
        : '/logos/Space8_ball_icon_black_white_bkg.svg'
      : theme === 'dark'
      ? '/logos/Space8_full_icon_white_black_bkg.svg'
      : '/logos/Space8_full_icon_black_white_bkg.svg'

  // Marks are square; the full lockup is wider than tall.
  const width = variant === 'mark' ? size : Math.round(size * 2.8)

  return (
    <Image
      src={src}
      alt="Space8"
      width={width}
      height={size}
      style={{ height: size, width: 'auto' }}
      priority
    />
  )
}
