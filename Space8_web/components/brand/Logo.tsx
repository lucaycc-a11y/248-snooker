import Image from 'next/image'

type LogoProps = {
  variant?: 'full' | 'mark'
  /** Background the logo sits on — picks the white-on-dark vs black-on-light artwork. */
  theme?: 'dark' | 'light'
  size?: number
}

export function Logo({ variant = 'full', theme = 'dark', size = 48 }: LogoProps) {
  // Transparent-background PNG exports — white artwork for dark sections,
  // black artwork for light sections, no CSS invert() hack needed.
  const src =
    variant === 'mark'
      ? theme === 'dark'
        ? encodeURI('/logos/White Version Squ, Tran 8.png')
        : encodeURI('/logos/Black Version Squ, Tran 8.png')
      : theme === 'dark'
        ? encodeURI('/logos/White Version Hor, Tran 8.png')
        : encodeURI('/logos/Black Version Hor, Tran 8.png')

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
      }}
      priority
    />
  )
}
