import { getMemberDashboardData } from '@/lib/data/getMemberRedesign'
import { MemberDashboardRedesign } from './MemberDashboardRedesign'
import { logSiteError } from '@/lib/errors/log'
import { notFound } from 'next/navigation'
import { headers } from 'next/headers'

// ════════════════════════════════════════════════════════════════════════════
// Member Page — Server Component wrapper for new dashboard
// Route: /member
// ════════════════════════════════════════════════════════════════════════════

export default async function MemberPage() {
  let data
  let fetchError: Error | null = null

  try {
    data = await getMemberDashboardData()
  } catch (err) {
    fetchError = err as Error

    // Log the error that occurred during data fetch
    const headersList = await headers()
    const pathname = headersList.get('x-pathname') || '/member'
    const userAgent = headersList.get('user-agent') || 'unknown'

    await logSiteError(
      'member-page-data-fetch-error',
      'error',
      'getMemberDashboardData threw an exception',
      {
        error_message: fetchError.message,
        error_stack: fetchError.stack,
        pathname,
        user_agent: userAgent,
      }
    )

    // If data fetch throws, trigger 404
    notFound()
  }

  if (!data) {
    // User not authenticated - log this case and show login prompt
    const headersList = await headers()
    const pathname = headersList.get('x-pathname') || '/member'
    const userAgent = headersList.get('user-agent') || 'unknown'

    await logSiteError(
      'member-page-no-data',
      'info',
      'getMemberDashboardData returned null (unauthenticated user)',
      {
        pathname,
        user_agent: userAgent,
        note: 'This is expected for unauthenticated users - showing login prompt',
      }
    )

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

  // Log successful data fetch
  await logSiteError(
    'member-page-success',
    'info',
    'Member page rendered successfully',
    {
      user_id: data.profile.id,
      tier: data.profile.tier,
      points: data.profile.points,
    }
  )

  return <MemberDashboardRedesign initialData={data} />
}
