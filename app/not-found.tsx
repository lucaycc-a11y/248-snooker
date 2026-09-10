import { MessageCircle } from 'lucide-react'
import BlackHole from '@/components/ui/black-hole'
import { SITE_CONTACT } from '@/lib/site/contact'

const WHATSAPP_URL = SITE_CONTACT.whatsappUrl

export default function NotFound() {
  return (
    <main
      data-nav-theme="dark"
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black px-6 py-16 text-white"
    >
      <div className="pointer-events-none absolute inset-0">
        <BlackHole />
      </div>

      <section className="relative z-10 flex w-full max-w-2xl flex-col items-center text-center">
        <p
          data-cms-key="404.brand"
          className="mb-5 text-[11px] font-medium uppercase tracking-[0.35em] text-white/65"
        >
          SPACE8
        </p>
        <h1
          data-cms-key="404.code"
          className="font-code text-[clamp(6rem,25vw,10rem)] leading-none text-[#22b86b] [text-shadow:0_0_32px_rgba(34,184,107,0.35)]"
        >
          404
        </h1>
        <p
          data-cms-key="404.subtitle"
          className="mt-5 text-balance font-[var(--font-sans)] text-lg leading-relaxed text-white/80 sm:text-xl"
        >
          找不到這個頁面
        </p>
        <p
          data-cms-key="404.description"
          className="mt-2 max-w-md font-[var(--font-sans)] text-sm leading-relaxed text-white/60 sm:text-base"
        >
          這個頁面可能已經移動或不存在。歡迎返回主頁，或立即預約您的桌球時段。
        </p>

        <div className="mt-8 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row">
          <a
            href="/book"
            data-cms-key="404.cta_book"
            className="flex min-h-11 w-full items-center justify-center rounded-[14px] border border-[#25D366] bg-[#25D366] px-8 py-3 text-base font-bold text-black transition-[transform,background-color] duration-150 hover:scale-[1.02] hover:bg-[#1FB855] sm:w-auto"
          >
            立即預約
          </a>
          <a
            href="/"
            data-cms-key="404.cta_home"
            className="flex min-h-11 w-full items-center justify-center rounded-[14px] border border-white/25 bg-transparent px-8 py-3 text-base font-medium text-white transition-colors duration-150 hover:border-white/60 hover:bg-white/10 sm:w-auto"
          >
            回到主頁
          </a>
        </div>

        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          data-cms-key="404.whatsapp"
          className="mt-8 inline-flex min-h-11 items-center gap-2 rounded-full px-4 py-2 text-sm text-white/70 transition-colors hover:text-white"
          aria-label="透過 WhatsApp 聯絡 Space8"
        >
          <MessageCircle size={18} strokeWidth={1.8} aria-hidden="true" />
          聯絡客服
        </a>
      </section>
    </main>
  )
}
