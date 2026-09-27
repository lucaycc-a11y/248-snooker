import { getTranslations } from 'next-intl/server'
import Image from 'next/image'
import { Link } from '@/i18n/navigation'
import { Logo } from '@/components/brand/Logo'
import { routing } from '@/i18n/routing'

// not-found.tsx is a Next.js special file that runs outside the normal layout
// render tree during prerender, so the next-intl middleware context is never
// seeded. We must not call getLocale() here — it throws when there is no
// request context, which crashes the entire [locale] segment during static
// generation (same digest 2260559448 on every locale page).
export const dynamic = 'force-dynamic'

export default async function NotFound() {
  const locale = routing.defaultLocale
  const t = await getTranslations({ locale, namespace: '404' })

  return (
    <main
      data-nav-theme="dark"
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black px-6 py-16 text-white"
    >
      {/* Desktop background */}
      <div className="pointer-events-none absolute inset-0 hidden sm:block">
        <Image
          src="/images/404-desktop-中八桌球-香港新蒲崗.webp"
          alt="404 background"
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
          alt="404 background"
          fill
          className="object-cover"
          style={{ objectPosition: 'center 35%' }}
          priority
          quality={90}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-black/70" />
      </div>

      <section className="relative z-10 flex w-full max-w-2xl flex-col items-center text-center">
        <div className="mb-5">
          <Logo variant="full" theme="dark" size={40} />
        </div>
        <h1
          data-cms-key="404.code"
          className="font-code text-[clamp(6rem,25vw,10rem)] leading-none text-[#22b86b] [text-shadow:0_0_32px_rgba(34,184,107,0.35)]"
        >
          {t('code')}
        </h1>
        <p
          data-cms-key="404.subtitle"
          className="mt-5 text-balance font-[var(--font-sans)] text-lg leading-relaxed text-white/80 sm:text-xl"
        >
          {t('subtitle')}
        </p>
        <p
          data-cms-key="404.description"
          className="mt-2 max-w-md font-[var(--font-sans)] text-sm leading-relaxed text-white/60 sm:text-base"
        >
          {t('description')}
        </p>

        <div className="mt-8 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row">
          <Link
            href="/book"
            data-cms-key="404.cta_book"
            className="flex min-h-11 w-full items-center justify-center rounded-[14px] border border-[#25D366] bg-[#25D366] px-8 py-3 text-base font-bold text-black transition-[transform,background-color] duration-150 hover:scale-[1.02] hover:bg-[#1FB855] sm:w-auto"
          >
            {t('cta_book')}
          </Link>
          <Link
            href="/"
            data-cms-key="404.cta_home"
            className="flex min-h-11 w-full items-center justify-center rounded-[14px] border border-white/25 bg-transparent px-8 py-3 text-base font-medium text-white transition-colors duration-150 hover:border-white/60 hover:bg-white/10 sm:w-auto"
          >
            {t('cta_home')}
          </Link>
        </div>
      </section>
    </main>
  )
}
