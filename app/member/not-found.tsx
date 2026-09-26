import Link from 'next/link'
import { FileQuestion } from 'lucide-react'

// ════════════════════════════════════════════════════════════════════════════
// Member Area 404 — Custom not-found page for /member/* routes
// ════════════════════════════════════════════════════════════════════════════

export default function MemberNotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#05070C] via-[#0A0D12] to-[#0F131C] px-4">
      <div className="w-full max-w-md text-center">
        {/* Icon */}
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-white/5">
          <FileQuestion className="h-10 w-10 text-white/30" strokeWidth={1.5} />
        </div>

        {/* Heading */}
        <h1 className="mt-6 font-code text-4xl font-bold text-white">404</h1>
        <p className="mt-2 text-lg text-white/60">找不到此頁面</p>

        {/* Description */}
        <p className="mt-4 text-sm text-white/40">
          您訪問的會員頁面不存在或已被移除
        </p>

        {/* Actions */}
        <div className="mt-8 flex flex-col gap-3">
          <Link
            href="/member"
            className="rounded-full bg-[#22c55e] px-6 py-3 font-medium text-white transition-colors hover:bg-[#16a34a]"
          >
            返回會員中心
          </Link>
          <Link
            href="/"
            className="rounded-full border border-white/20 bg-white/5 px-6 py-3 font-medium text-white transition-colors hover:border-white/30 hover:bg-white/10"
          >
            返回首頁
          </Link>
        </div>
      </div>
    </div>
  )
}
