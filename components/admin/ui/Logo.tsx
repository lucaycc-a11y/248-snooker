'use client'

type LogoProps = {
  className?: string
}

export default function Logo({ className }: LogoProps) {
  return (
    <a
      href="/admin/style-guide"
      aria-label="SPACE8 style guide"
      className={`inline-flex min-h-11 min-w-11 items-center gap-2 text-[var(--text-primary)] ${className ?? ''}`}
    >
      <svg viewBox="0 0 196 42" role="img" aria-hidden="true" className="h-7 w-auto">
        <path
          fill="currentColor"
          d="M3 8.5C3 5.46 5.46 3 8.5 3h20C31.54 3 34 5.46 34 8.5v25c0 3.04-2.46 5.5-5.5 5.5h-20C5.46 39 3 36.54 3 33.5v-25Zm7.3 4.8h15.2c1.6 0 2.9 1.3 2.9 2.9v8.8c0 1.6-1.3 2.9-2.9 2.9H17l-3.7 4.1v-4.1h-3c-1.6 0-2.9-1.3-2.9-2.9v-8.8c0-1.6 1.3-2.9 2.9-2.9Zm3.7 4.2v7.1h3.1v-7.1H14Zm5.8 0v7.1h3.1v-7.1h-3.1Z"
        />
        <path fill="currentColor" d="M44 30.8V11.2h10.6c5.2 0 8.2 2.7 8.2 7s-3 7-8.2 7h-5.4v5.6H44Zm5.2-10h5c2.2 0 3.4-.8 3.4-2.6s-1.2-2.6-3.4-2.6h-5v5.2Zm26.1 10.4c-7.1 0-11.3-3.8-11.3-10s4.2-10.4 11.3-10.4c4.7 0 8.4 1.8 10.3 5.1l-4.2 2.5c-1.2-2-3.2-3-6-3-3.9 0-6.3 2-6.3 5.7 0 3.5 2.4 5.6 6.3 5.6 2.8 0 4.8-1 6-3l4.2 2.5c-1.9 3.2-5.6 5-10.3 5Zm12.5-.4V11.2h16.8v4.5H93v3.1h10.2v4.4H93v3.2h11.7v4.4H87.8Zm20.5 0 7.8-10.1-7.5-9.5h6.2l4.6 6 4.6-6h6l-7.6 9.5 7.8 10.1h-6.2l-4.8-6.4-4.9 6.4h-6Zm25.3 0V11.2h5.2v19.6h-5.2Zm9.7 0V11.2h16.8v4.5h-11.6v3.1h10.2v4.4h-10.2v3.2h11.7v4.4h-16.9Z" />
      </svg>
    </a>
  )
}
