import Image from 'next/image'

type LogoProps = {
  variant?: 'full' | 'mark'
  size?: number
}

export function Logo({ variant = 'full', size = 48 }: LogoProps) {
  const src = variant === 'full' ? '/2.svg' : '/1.svg'

  return (
    <Image
      src={src}
      alt="248 Snooker Club"
      width={size}
      height={size}
      style={{ height: size, width: 'auto' }}
      priority
    />
  )
}
