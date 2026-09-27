'use client'

import Image from 'next/image'

export default function Error({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <main
      data-nav-theme="dark"
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black px-6 py-16 text-white"
    >
      {/* Desktop background */}
      <div className="pointer-events-none absolute inset-0 hidden sm:block">
        <Image
          src="/images/404-desktop-中八桌球-香港新蒲崗.webp"
          alt="Error background"
          fill
          className="object-cover"
          style={{ objectPosition: 'center 40%' }}
          priority
          quality={90}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-black/70" />
      </div>

      {/* Mobile background */}
      <div className="pointer-events-none absolute inset-0 sm:hidden">
        <Image
          src="/images/404-mobile-中八桌球-香港新蒲崗.webp"
          alt="Error background"
          fill
          className="object-cover"
          style={{ objectPosition: 'center 35%' }}
          priority
          quality={90}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-black/70" />
      </div>

      <section className="relative z-10 flex w-full max-w-2xl flex-col items-center text-center">
        <p
          data-cms-key="error.brand"
          className="mb-5 text-[11px] font-medium uppercase tracking-[0.35em] text-white/65"
        >
          SPACE8
        </p>
        <h1
          data-cms-key="error.code"
          className="font-code text-[clamp(6rem,25vw,10rem)] leading-none text-[#22b86b] [text-shadow:0_0_32px_rgba(34,184,107,0.35)]"
        >
          ERROR
        </h1>
        <p
          data-cms-key="error.subtitle"
          className="mt-5 text-balance font-[var(--font-sans)] text-lg leading-relaxed text-white/80 sm:text-xl"
        >
          出錯了
        </p>
        <p
          data-cms-key="error.description"
          className="mt-2 max-w-md font-[var(--font-sans)] text-sm leading-relaxed text-white/60 sm:text-base"
        >
          系統遇到問題。請稍後再試，或返回主頁重新開始。
        </p>

        <div className="mt-8 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row">
          <button
            onClick={() => reset()}
            data-cms-key="error.cta_retry"
            className="flex min-h-11 w-full items-center justify-center rounded-[14px] border border-[#25D366] bg-[#25D366] px-8 py-3 text-base font-bold text-black transition-[transform,background-color] duration-150 hover:scale-[1.02] hover:bg-[#1FB855] sm:w-auto"
          >
            重試
          </button>
          <a
            href="/"
            data-cms-key="error.cta_home"
            className="flex min-h-11 w-full items-center justify-center rounded-[14px] border border-white/25 bg-transparent px-8 py-3 text-base font-medium text-white transition-colors duration-150 hover:border-white/60 hover:bg-white/10 sm:w-auto"
          >
            回到主頁
          </a>
        </div>
      </section>
    </main>
  )
}
