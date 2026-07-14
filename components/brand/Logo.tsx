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
        ? '/logos/space8_logo_white_squ.svg'
        : '/logos/space8_logo_black_squ.svg'
      : theme === 'dark'
        ? '/logos/space8_logo_white_hor.svg'
        : '/logos/space8_logo_black_hor.svg'

  // Marks are square (1080×1080); the full lockup is 1560.86×500.
  const width = variant === 'mark' ? size : Math.round(size * 3.12)

  return (
    <Image
      src={src}
      alt="Space8"
      width={width}
      height={size}
      style={{
        height: size,
        width: 'auto',
      }}
      priority
    />
  )
}
