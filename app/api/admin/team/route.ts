/**
 * Admin team API — collection.
 *
 * GET: list `admin_users` rows. Any active admin can read the roster;
 * mutations (invite/revoke/role) are super_admin-only and live in
 * ./[id]/route.ts and ../invite/route.ts.
 */

import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { getServiceSupabase } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const admin = await getAdminData()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const service = getServiceSupabase()
    const { data, error } = await service
      .from('admin_users')
      .select('id, email, role, invite_status, user_id, invited_by, created_at')
      .order('created_at', { ascending: true })

    if (error) {
      console.error('[admin/team] query error', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ rows: data ?? [] })
  } catch (err) {
    console.error('[admin/team] GET error', err)
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
