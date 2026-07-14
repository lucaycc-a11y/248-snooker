import { getTranslations } from 'next-intl/server'
import Nav from '@/components/layout/Nav'
import { Link } from '@/i18n/navigation'
import { Snooker404Table } from './Snooker404Table'

export default async function NotFound() {
  const t = await getTranslations('404')

  return (
    <main
      data-nav-theme="dark"
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-black px-4 py-28 text-white sm:px-6"
    >
      <Nav />

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(34,197,94,0.16),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.06),transparent_28%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.86))]" />

      <section className="relative z-10 flex w-full max-w-3xl flex-col items-center gap-6 text-center">
        <div>
          <p
            data-cms-key="404.title"
            className="mb-3 text-[13px] font-medium uppercase tracking-[0.32em] text-white/45"
          >
            {t('title')}
          </p>
          <h1
            data-cms-key="404.code"
            className="font-['Bebas_Neue',Impact,sans-serif] text-[clamp(80px,22vw,180px)] leading-none tracking-[-0.02em] text-white"
          >
            {t('code')}
          </h1>
        </div>

        <p
          data-cms-key="404.subtitle"
          className="max-w-xl text-balance text-[17px] leading-relaxed text-white/55 sm:text-[19px]"
        >
          {t('subtitle')}
        </p>

        <Snooker404Table hint={t('hint')} completedText={t('completed')} canvasLabel={t('canvas_label')} />

        <div className="flex w-full flex-col items-center gap-4 pt-2 sm:flex-row sm:justify-center">
          <Link
            href="/book"
            data-cms-key="404.cta_book"
            className="flex min-h-11 w-full items-center justify-center rounded-full border border-[#22C55E] bg-[#22C55E] px-10 py-4 text-[17px] font-bold text-black transition-[transform,background-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-[1.03] hover:bg-[#2BE66A] sm:w-auto"
          >
            {t('cta_book')}
          </Link>
          <Link
            href="/"
            data-cms-key="404.cta_home"
            className="flex min-h-11 items-center justify-center rounded-full px-6 py-3 text-[15px] font-medium text-white/45 transition-colors duration-300 hover:text-white/75"
          >
            {t('cta_home')}
          </Link>
        </div>
      </section>
    </main>
  )
}
