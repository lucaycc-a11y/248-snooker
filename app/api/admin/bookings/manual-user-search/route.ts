/**
 * GET /api/admin/bookings/manual-user-search?q=
 *
 * Search users for manual booking creation (link a booking to a user).
 * Reuses the same search shape as /api/admin/search (users section).
 * Auth: getAdminData() guard.
 */

import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { getServiceSupabase } from '@/lib/supabase/service'

export const runtime = 'nodejs'

const MAX_RESULTS = 8

export async function GET(req: Request) {
  try {
    const admin = await getAdminData()
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized — admin only' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const q = (searchParams.get('q') ?? '').trim()

    // Empty query → return nothing (avoid full-table scans from the UI)
    if (q.length < 2) {
      return NextResponse.json({ users: [] })
    }

    const service = getServiceSupabase()
    const { data, error } = await service
      .from('users')
      .select('id, email, display_name, phone, member_code, tier')
      .or(
        `email.ilike.%${q}%,phone.ilike.%${q}%,member_code.ilike.%${q}%,display_name.ilike.%${q}%`
      )
      .order('created_at', { ascending: false })
      .limit(MAX_RESULTS)

    if (error) {
      console.error('[manual-user-search] query_failed', { message: error.message })
      return NextResponse.json({ error: 'Search failed' }, { status: 500 })
    }

    const users = (data ?? []).map((row) => {
      const record = row as Record<string, unknown>
      const s = (keys: string[]): string => {
        for (const k of keys) {
          const v = record[k]
          if (typeof v === 'string' && v.length > 0) return v
        }
        return ''
      }
      return {
        id: s(['id']),
        email: s(['email']),
        displayName: s(['display_name']),
        phone: s(['phone']),
        memberCode: s(['member_code']),
        tier: s(['tier']),
      }
    })

    return NextResponse.json({ users })
  } catch (err) {
    console.error('[manual-user-search] error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
