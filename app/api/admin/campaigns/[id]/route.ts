/**
 * PATCH  /api/admin/campaigns/[id] — update campaign fields / status transition
 * DELETE /api/admin/campaigns/[id] — soft-end (set status='ended') or hard-delete if draft
 *
 * Auth: getAdminData() guard. All writes log to admin_action_log.
 */

import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { getServiceSupabase } from '@/lib/supabase/service'
import { str } from '@/lib/data/adminReadHelpers'

export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }
type CampaignRow = Record<string, unknown>

const SELECT_COLS = 'id, name, description, starts_at, ends_at, status, created_by, created_at'

export async function PATCH(req: Request, { params }: Params) {
  try {
    const admin = await getAdminData()
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized — admin only' }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json().catch(() => null)
    const raw = (body ?? {}) as Record<string, unknown>

    const service = getServiceSupabase()

    // Fetch existing for before_jsonb
    const { data: existing, error: fetchErr } = await service
      .from('campaigns')
      .select('id, name, description, starts_at, ends_at, status')
      .eq('id', id)
      .single()

    if (fetchErr || !existing) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    const update: Record<string, unknown> = {}

    if (typeof raw.name === 'string' && raw.name.trim()) {
      update.name = raw.name.trim()
    }
    if (typeof raw.description === 'string') {
      update.description = raw.description.trim() || null
    }
    if (typeof raw.startsAt === 'string') {
      if (Number.isNaN(Date.parse(raw.startsAt))) {
        return NextResponse.json({ error: 'Invalid startsAt date' }, { status: 400 })
      }
      update.starts_at = raw.startsAt
    }
    if (typeof raw.endsAt === 'string') {
      if (Number.isNaN(Date.parse(raw.endsAt))) {
        return NextResponse.json({ error: 'Invalid endsAt date' }, { status: 400 })
      }
      update.ends_at = raw.endsAt
    }

    // Status transition: only valid transitions allowed
    if (typeof raw.status === 'string' && raw.status) {
      const currentStatus = str(existing, ['status']) ?? 'draft'
      const nextStatus = raw.status
      const validTransitions: Record<string, string[]> = {
        draft: ['active', 'ended'],
        active: ['ended'],
        ended: [], // terminal — no transitions
      }
      if (!validTransitions[currentStatus]?.includes(nextStatus)) {
        return NextResponse.json(
          { error: `Cannot transition from "${currentStatus}" to "${nextStatus}"` },
          { status: 400 },
        )
      }
      update.status = nextStatus
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const { data: updated, error } = await service
      .from('campaigns')
      .update(update)
      .eq('id', id)
      .select(SELECT_COLS)
      .single()

    if (error) {
      console.error('[campaigns/[id]] patch_failed', { id, message: error.message })
      return NextResponse.json({ error: 'Failed to update campaign' }, { status: 500 })
    }

    await service.from('admin_action_log').insert({
      admin_id: admin.userId,
      admin_email: admin.email,
      action_type: 'campaign_updated',
      target_table: 'campaigns',
      target_id: id,
      before_jsonb: {
        name: existing.name,
        status: existing.status,
        starts_at: existing.starts_at,
        ends_at: existing.ends_at,
      },
      after_jsonb: update,
      risk_level: update.status ? 'medium' : 'low',
    })

    return NextResponse.json({ campaign: serializeCampaign(updated as CampaignRow) })
  } catch (err) {
    const e = err as Error
    console.error('[campaigns/[id]] error', { message: e.message, stack: e.stack })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: Params) {
  try {
    const admin = await getAdminData()
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized — admin only' }, { status: 401 })
    }

    const { id } = await params

    const service = getServiceSupabase()

    const { data: existing, error: fetchErr } = await service
      .from('campaigns')
      .select('id, name, status')
      .eq('id', id)
      .single()

    if (fetchErr || !existing) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    const currentStatus = str(existing, ['status']) ?? 'draft'

    // Drafts: hard delete. Active/Ended: soft-end (set status='ended')
    if (currentStatus === 'draft') {
      const { error } = await service.from('campaigns').delete().eq('id', id)
      if (error) {
        console.error('[campaigns/[id]] delete_failed', { id, message: error.message })
        return NextResponse.json({ error: 'Failed to delete campaign' }, { status: 500 })
      }

      await service.from('admin_action_log').insert({
        admin_id: admin.userId,
        admin_email: admin.email,
        action_type: 'campaign_deleted',
        target_table: 'campaigns',
        target_id: id,
        before_jsonb: { name: existing.name, status: currentStatus },
        after_jsonb: null,
        risk_level: 'medium',
      })

      return NextResponse.json({ success: true })
    }

    // Non-draft: soft-end
    const { error } = await service
      .from('campaigns')
      .update({ status: 'ended' })
      .eq('id', id)

    if (error) {
      console.error('[campaigns/[id]] end_failed', { id, message: error.message })
      return NextResponse.json({ error: 'Failed to end campaign' }, { status: 500 })
    }

    await service.from('admin_action_log').insert({
      admin_id: admin.userId,
      admin_email: admin.email,
      action_type: 'campaign_ended',
      target_table: 'campaigns',
      target_id: id,
      before_jsonb: { status: currentStatus },
      after_jsonb: { status: 'ended' },
      risk_level: 'medium',
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    const e = err as Error
    console.error('[campaigns/[id]] error', { message: e.message, stack: e.stack })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

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
