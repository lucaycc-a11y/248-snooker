import { getMemberDashboardData } from '@/lib/data/getMemberRedesign'
import { MemberDashboardRedesign } from './MemberDashboardRedesign'

// ════════════════════════════════════════════════════════════════════════════
// Member Page — Server Component wrapper for new dashboard
// Route: /member
// ════════════════════════════════════════════════════════════════════════════

export default async function MemberPage() {
  const data = await getMemberDashboardData()

  if (!data) {
    // User not authenticated - redirect to login
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#05070C] via-[#0A0D12] to-[#0F131C]">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white">請先登入</h1>
          <p className="mt-2 text-white/60">Please log in to access your member dashboard</p>
          <a
            href="/auth/login"
            className="mt-6 inline-block rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 px-8 py-3 font-medium text-white transition-all hover:from-blue-600 hover:to-cyan-600"
          >
            登入 / Login
          </a>
        </div>
      </div>
    )
  }

  return <MemberDashboardRedesign initialData={data} />
}
