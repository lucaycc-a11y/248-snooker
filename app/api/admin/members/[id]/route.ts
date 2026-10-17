import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'
import { num, str, type Row } from '@/lib/data/adminReadHelpers'

// Manual member management — points adjustment, tier change, blacklist
// toggle. Available to both admin and super_admin (unlike invite/revoke).
// Every action requires a non-empty `reason`, audit-logged with before/after.

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const VALID_TIERS = ['amateur', 'century', 'maximum']

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getAdminData()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body: unknown = await req.json().catch(() => null)
    if (!isRecord(body) || typeof body.reason !== 'string' || body.reason.trim().length === 0) {
      return NextResponse.json({ error: 'A reason is required' }, { status: 400 })
    }
    const reason = body.reason.trim()

    const service = getLegacyServiceSupabase()
    const { data: existing } = await service
      .from('users')
      .select('id, points, tier, is_blacklisted')
      .eq('id', id)
      .maybeSingle()
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const target = existing as Row

    let action: string
    let patch: Record<string, unknown>
    let beforeValue: Record<string, unknown>
    let afterValue: Record<string, unknown>

    if (body.action === 'adjust_points') {
      const delta = typeof body.delta === 'number' ? body.delta : Number(body.delta)
      if (!Number.isFinite(delta) || delta === 0) {
        return NextResponse.json({ error: 'Invalid points delta' }, { status: 400 })
      }
      const currentPoints = num(target, ['points'], 0)
      const newPoints = Math.max(0, currentPoints + delta)
      action = 'member_adjust_points'
      patch = { points: newPoints }
      beforeValue = { points: currentPoints, reason }
      afterValue = { points: newPoints, delta, reason }
    } else if (body.action === 'adjust_credit') {
      // Credit lives in credits_ledger, not on `users` — insert a ledger row
      // instead of patching the user. Type must be one of CREDITS_LEDGER_TYPES.
      const amount = typeof body.delta === 'number' ? body.delta : Number(body.delta)
      if (!Number.isFinite(amount) || amount === 0) {
        return NextResponse.json({ error: 'Invalid credit amount' }, { status: 400 })
      }

      const { data: ledgerRows } = await service
        .from('credits_ledger')
        .select('amount')
        .eq('user_id', id)
      const balance = (ledgerRows ?? []).reduce((sum, r) => sum + num(r as Row, ['amount'], 0), 0)
      const balanceAfter = balance + amount

      const { error: ledgerError } = await service.from('credits_ledger').insert({
        user_id: id,
        amount,
        balance_after: balanceAfter,
        type: 'manual',
        note: reason,
        actor_id: admin.userId,
      })
      if (ledgerError) {
        console.error('[admin/members] credits_ledger insert failed', ledgerError)
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
      }

      await service.from('admin_action_log').insert({
        admin_user_id: admin.userId,
        admin_email: admin.email,
        action_type: 'member_adjust_credit',
        target_table: 'credits_ledger',
        target_id: id,
        before_jsonb: { balance, reason },
        after_jsonb: { balance_after: balanceAfter, amount, reason },
        risk_level: 'medium',
      })

      return NextResponse.json({ success: true })
    } else if (body.action === 'send_message') {
      // Per-member inbox message → admin_notifications.
      const title = typeof body.title === 'string' ? body.title.trim() : ''
      const message = typeof body.message === 'string' ? body.message.trim() : ''
      if (!title || !message) {
        return NextResponse.json({ error: 'Title and message are required' }, { status: 400 })
      }

      const { error: notifyError } = await service.from('admin_notifications').insert({
        user_id: id,
        title,
        message,
        type: 'system',
        read: false,
      })
      if (notifyError) {
        console.error('[admin/members] admin_notifications insert failed', notifyError)
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
      }

      await service.from('admin_action_log').insert({
        admin_user_id: admin.userId,
        admin_email: admin.email,
        action_type: 'member_message',
        target_table: 'admin_notifications',
        target_id: id,
        before_jsonb: null,
        after_jsonb: { title, reason },
        risk_level: 'low',
      })

      return NextResponse.json({ success: true })
    } else if (body.action === 'set_tier') {
      if (typeof body.tier !== 'string' || !VALID_TIERS.includes(body.tier)) {
        return NextResponse.json({ error: 'Invalid tier' }, { status: 400 })
      }
      action = 'member_set_tier'
      patch = { tier: body.tier }
      beforeValue = { tier: str(target, ['tier']), reason }
      afterValue = { tier: body.tier, reason }
    } else if (body.action === 'toggle_blacklist') {
      if (typeof body.blacklisted !== 'boolean') {
        return NextResponse.json({ error: 'Invalid blacklisted value' }, { status: 400 })
      }
      action = body.blacklisted ? 'member_blacklist' : 'member_unblacklist'
      patch = { is_blacklisted: body.blacklisted }
      beforeValue = { is_blacklisted: target.is_blacklisted === true, reason }
      afterValue = { is_blacklisted: body.blacklisted, reason }
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    const { error } = await service.from('users').update(patch).eq('id', id)
    if (error) {
      console.error('[admin/members] update failed', error)
      return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }

    await service.from('admin_action_log').insert({
      admin_user_id: admin.userId,
      admin_email: admin.email,
      action_type: action,
      target_table: 'users',
      target_id: id,
      before_jsonb: beforeValue,
      after_jsonb: afterValue,
      risk_level: 'medium',
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[admin/members] unexpected error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
