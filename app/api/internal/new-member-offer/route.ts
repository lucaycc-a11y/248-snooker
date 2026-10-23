import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@/lib/supabase/route-handler'
import { getServiceSupabase } from '@/lib/supabase/service'
import { getNewMemberOffer } from '@/lib/pricing/new-member-offer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/internal/new-member-offer
// Preview feed for the "new members from HK$X" copy. Only an active super_admin
// gets data; everyone else gets a bare 404 so the feature is not discoverable.
export async function GET() {
  const notFound = () => new NextResponse(null, { status: 404, headers: { 'Cache-Control': 'no-store' } })

  const supabase = await createRouteHandlerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return notFound()

  const service = getServiceSupabase()
  const { data: admin } = await service
    .from('admin_users')
    .select('role, invite_status, is_active')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!admin || admin.role !== 'super_admin' || admin.invite_status !== 'active' || admin.is_active === false) {
    return notFound()
  }

  const offer = await getNewMemberOffer()
  if (!offer) return notFound()
  return NextResponse.json(offer, { headers: { 'Cache-Control': 'no-store' } })
}
