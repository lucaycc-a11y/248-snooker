/**
 * Admin users API — §9.4.
 *
 * GET: paginated user list with tier/activity status.
 * PATCH: update user fields (all require reason, logged to admin_action_log).
 *
 * Design system: admin-theme.css variables only.
 * No inline hex, no shadows.
 */

import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { getAdminMembers } from '@/lib/data/getAdminMembers'
import { getServiceSupabase } from '@/lib/supabase/service'

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

// ── GET: paginated user list ──────────────────────────────────────────────

export async function GET(req: Request) {
  try {
    const admin = await getAdminData()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const url = new URL(req.url)
    const result = await getAdminMembers({
      page: parseInt(url.searchParams.get('page') ?? '1', 10) || 1,
      search: url.searchParams.get('search'),
    })
    return NextResponse.json(result)
  } catch (err) {
    console.error('[admin/users] GET error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// ── PATCH: update user profile fields ─────────────────────────────────────

const UPDATABLE_FIELDS = [
  'display_name',
  'email',
  'phone',
  'tier',
  'points',
  'is_blacklisted',
] as const

type UpdatableField = (typeof UPDATABLE_FIELDS)[number]

export async function PATCH(req: Request) {
  try {
    const admin = await getAdminData()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body: unknown = await req.json().catch(() => null)
    if (!isRecord(body)) {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
    }

    // Must have userId + reason + at least one field to update
    const userId = typeof body.userId === 'string' ? body.userId : null
    const reason = typeof body.reason === 'string' ? body.reason.trim() : null
    if (!userId || !reason || reason.length === 0) {
      return NextResponse.json(
        { error: 'userId and reason are required' },
        { status: 400 },
      )
    }

    // Build the patch from only updatable fields present in the body
    const patch: Record<string, unknown> = {}
    for (const field of UPDATABLE_FIELDS) {
      if (field in body) {
        patch[field] = body[field]
      }
    }
    if (Object.keys(patch).length === 0) {
      return NextResponse.json(
        { error: 'At least one field to update is required' },
        { status: 400 },
      )
    }

    const service = getServiceSupabase()

    // Fetch existing row for before/after audit
    const { data: existing, error: fetchErr } = await service
      .from('users')
      .select('id, display_name, email, phone, tier, points, is_blacklisted')
      .eq('id', userId)
      .maybeSingle()

    if (fetchErr || !existing) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const beforeValue: Record<string, unknown> = {}
    const afterValue: Record<string, unknown> = {}
    for (const field of Object.keys(patch) as UpdatableField[]) {
      beforeValue[field] = (existing as Record<string, unknown>)[field] ?? null
      afterValue[field] = patch[field]
    }
    beforeValue.reason = reason
    afterValue.reason = reason

    // Apply update
    const { error: updateErr } = await service
      .from('users')
      .update(patch)
      .eq('id', userId)

    if (updateErr) {
      console.error('[admin/users] PATCH update failed', updateErr)
      return NextResponse.json({ error: 'Update failed' }, { status: 500 })
    }

    // Log to admin_action_log
    await service.from('admin_action_log').insert({
      admin_user_id: admin.userId,
      admin_email: admin.email,
      action_type: 'user_profile_update',
      target_table: 'users',
      target_id: userId,
      before_jsonb: beforeValue,
      after_jsonb: afterValue,
      risk_level: 'medium',
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[admin/users] PATCH error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
