'use client'

// ════════════════════════════════════════════════════════════════════════════
// Legal Page — Links to all legal documents
// ════════════════════════════════════════════════════════════════════════════

export default function LegalPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#05070C] via-[#0A0D12] to-[#0F131C]">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-[#0A0D12]/80 backdrop-blur-xl">
        <div className="mx-auto max-w-3xl px-4 py-4">
          <div className="flex items-center justify-between">
            <a href="/member" className="text-white/60 transition-colors hover:text-white">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </a>
            <h1 className="text-lg font-medium text-white">Legal</h1>
            <div className="w-6" />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-6">
        <div className="space-y-3">
          <LegalLink
            title="退款政策"
            subtitle="Refund Policy"
            href="/legal/refund-policy"
          />
          <LegalLink
            title="場地使用守則及條款"
            subtitle="Venue Rules & Terms"
            href="/legal/venue-terms"
          />
          <LegalLink
            title="安全守則"
            subtitle="Safety Guidelines"
            href="/member/safety"
          />
          <LegalLink
            title="交付政策"
            subtitle="Delivery Policy"
            href="/legal/delivery-policy"
          />
          <LegalLink
            title="私隱政策"
            subtitle="Privacy Policy"
            href="/legal/privacy"
          />
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent p-6 text-center">
          <p className="text-sm text-white/60">最後更新：2026年7月14日</p>
        </div>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// § LEGAL LINK
// ────────────────────────────────────────────────────────────────────────────

type LegalLinkProps = {
  title: string
  subtitle: string
  href: string
}

function LegalLink({ title, subtitle, href }: LegalLinkProps) {
  return (
    <a
      href={href}
      className="block rounded-xl border border-white/10 bg-gradient-to-r from-white/5 to-transparent p-4 transition-all hover:border-white/20 hover:from-white/10"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-white">{title}</p>
          <p className="text-xs text-white/50">{subtitle}</p>
        </div>
        <svg className="h-5 w-5 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </a>
  )
}
