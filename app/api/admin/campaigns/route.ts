/**
 * GET  /api/admin/campaigns — list campaigns (+ claim count)
 * POST /api/admin/campaigns — create a campaign
 *
 * Auth: getAdminData() guard. All writes log to admin_action_log.
 */

import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { getServiceSupabase } from '@/lib/supabase/service'
import { num, str } from '@/lib/data/adminReadHelpers'

export const runtime = 'nodejs'

type CampaignRow = Record<string, unknown>

const SELECT_COLS = 'id, name, description, starts_at, ends_at, status, created_by, created_at'

function serializeCampaign(row: CampaignRow) {
  return {
    id: str(row, ['id']),
    name: str(row, ['name']),
    description: str(row, ['description']),
    startsAt: str(row, ['starts_at']),
    endsAt: str(row, ['ends_at']),
    status: str(row, ['status']),
    createdBy: str(row, ['created_by']),
    createdAt: str(row, ['created_at']),
  }
}

export async function GET() {
  try {
    const admin = await getAdminData()
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized — admin only' }, { status: 401 })
    }

    const service = getServiceSupabase()

    const { data, error } = await service
      .from('campaigns')
      .select(SELECT_COLS)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[campaigns] list_failed', { message: error.message })
      return NextResponse.json({ error: 'Failed to list campaigns' }, { status: 500 })
    }

    const rows = (data ?? []) as CampaignRow[]

    // Batch claim counts
    const { data: claims } = await service
      .from('campaign_claims')
      .select('campaign_id')

    const claimCount = new Map<string, number>()
    for (const c of (claims ?? []) as CampaignRow[]) {
      const cid = str(c, ['campaign_id'])
      if (cid) claimCount.set(cid, (claimCount.get(cid) ?? 0) + 1)
    }

    const campaigns = rows.map((r) => ({
      ...serializeCampaign(r),
      claimCount: claimCount.get(str(r, ['id']) ?? '') ?? 0,
    }))

    return NextResponse.json({ campaigns })
  } catch (err) {
    const e = err as Error
    console.error('[campaigns] error', { message: e.message, stack: e.stack })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const admin = await getAdminData()
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized — admin only' }, { status: 401 })
    }

    const body = await req.json().catch(() => null)
    const raw = (body ?? {}) as Record<string, unknown>

    const name = typeof raw.name === 'string' ? raw.name.trim() : ''
    const description = typeof raw.description === 'string' ? raw.description.trim() : ''
    const startsAt = typeof raw.startsAt === 'string' ? raw.startsAt : new Date().toISOString()
    const endsAt = typeof raw.endsAt === 'string' ? raw.endsAt : ''
    const status = typeof raw.status === 'string' ? raw.status : 'draft'

    if (!name || name.length > 200) {
      return NextResponse.json({ error: 'Name is required (max 200 chars)' }, { status: 400 })
    }
    if (!endsAt || Number.isNaN(Date.parse(endsAt))) {
      return NextResponse.json({ error: 'endsAt is required' }, { status: 400 })
    }
    if (!['draft', 'active', 'ended'].includes(status)) {
      return NextResponse.json({ error: 'Status must be draft, active, or ended' }, { status: 400 })
    }

    const service = getServiceSupabase()

    const payload: Record<string, unknown> = {
      name,
      description: description || null,
      starts_at: startsAt,
      ends_at: endsAt,
      status,
      created_by: admin.userId,
    }

    const { data: inserted, error } = await service
      .from('campaigns')
      .insert(payload)
      .select(SELECT_COLS)
      .single()

    if (error) {
      console.error('[campaigns] create_failed', { message: error.message })
      return NextResponse.json({ error: 'Failed to create campaign' }, { status: 500 })
    }

    await service.from('admin_action_log').insert({
      admin_id: admin.userId,
      admin_email: admin.email,
      action_type: 'campaign_created',
      target_table: 'campaigns',
      target_id: (inserted as CampaignRow | null)?.id ? str(inserted as CampaignRow, ['id']) : null,
      after_jsonb: { name, description, starts_at: startsAt, ends_at: endsAt, status },
      risk_level: 'low',
    })

    return NextResponse.json({ campaign: serializeCampaign(inserted as CampaignRow) }, { status: 201 })
  } catch (err) {
    const e = err as Error
    console.error('[campaigns] error', { message: e.message, stack: e.stack })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
