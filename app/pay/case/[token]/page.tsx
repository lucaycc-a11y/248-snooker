import type { Metadata } from 'next'
import { Logo } from '@/components/brand/Logo'
import { loadCaseByToken } from '@/lib/cases/service'
import { SCENARIOS } from '@/lib/cases/scenarios'
import { SITE_CONTACT } from '@/lib/site/contact'
import PayCaseClient from './PayCaseClient'

export const metadata: Metadata = {
  title: '違規個案繳付 | Space8',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

const hkDate = (iso: string | null): string =>
  iso ? new Intl.DateTimeFormat('zh-HK', { timeZone: 'Asia/Hong_Kong', year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(iso)) : ''

export default async function PayCasePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const { token } = await params
  const sp = (await searchParams) ?? {}
  const c = await loadCaseByToken(token)

  return (
    <main data-nav-theme="dark" className="flex min-h-screen items-center justify-center bg-black px-5 py-12 text-white">
      <div className="w-full max-w-[440px]">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>

        {!c || c.status === 'draft' ? (
          <Notice title="連結無效" body="此連結不存在或已失效。如有疑問，請 WhatsApp 聯絡我們。" />
        ) : (
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <p className="text-xs tracking-wide text-white/50">個案編號 {c.case_no}</p>
            <h1 className="mt-1 text-xl font-semibold">{c.title}</h1>
            <p className="mt-1 text-sm text-white/60">違反《場地使用守則及條款》{SCENARIOS[c.scenario].clause}</p>

            {c.detail && <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-white/70">{c.detail}</p>}

            <div className="my-5 border-t border-white/10" />

            <div className="flex items-baseline justify-between">
              <span className="text-sm text-white/60">應繳費用</span>
              <span className="text-2xl font-semibold">HK${c.amount.toLocaleString('en-US')}</span>
            </div>
            {c.due_at && c.status !== 'paid' && <p className="mt-1 text-right text-xs text-white/50">繳付期限：{hkDate(c.due_at)}</p>}

            <div className="mt-6">
              <PayCaseClient
                token={token}
                status={c.status}
                amount={c.amount}
                returnedFromGateway={sp.from === 'kpay'}
              />
            </div>
          </section>
        )}

        <p className="mt-6 text-center text-xs text-white/40">
          如對個案有異議，請
          <a href={SITE_CONTACT.whatsappUrl} className="text-[#22c55e] underline underline-offset-2">
            WhatsApp 聯絡我們
          </a>
          並提供個案編號。
        </p>
      </div>
    </main>
  )
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center">
      <h1 className="text-lg font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-white/60">{body}</p>
    </section>
  )
}
