import { getMemberDashboardData } from '@/lib/data/getMemberRedesign'
import { MemberPageClient } from './MemberPageClient'
import { MemberAuthGuard } from './components/MemberAuthGuard'
import { logSiteError } from '@/lib/errors/log'

// ════════════════════════════════════════════════════════════════════════════
// Member Page — Full Rebuild (Mobile-First, Single Scroll)
// Route: /member
// Replaces tab-based navigation with premium single-page experience
// ════════════════════════════════════════════════════════════════════════════

// Force dynamic rendering - this page requires authentication
export const dynamic = 'force-dynamic'

export default async function MemberPage() {
  let data
  let fetchError: Error | null = null

  try {
    data = await getMemberDashboardData()
  } catch (err) {
    fetchError = err as Error

    await logSiteError(
      'member-page-data-fetch-error',
      'error',
      'getMemberDashboardData threw an exception',
      {
        error_message: fetchError.message,
        error_stack: fetchError.stack,
      }
    )

    // Show auth guard (will display AuthModal)
    return <MemberAuthGuard />
  }

  if (!data) {
    await logSiteError(
      'member-page-no-data',
      'info',
      'getMemberDashboardData returned null (unauthenticated user)',
      {
        note: 'Showing AuthModal via MemberAuthGuard',
      }
    )

    // Show auth guard (will display AuthModal)
    return <MemberAuthGuard />
  }

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

  return <MemberPageClient initialData={data} />
}
