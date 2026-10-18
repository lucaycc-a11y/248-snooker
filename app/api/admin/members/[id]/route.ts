import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'
import { str, type Row } from '@/lib/data/adminReadHelpers'
import { writeAdminActionLog } from '@/lib/admin/audit'

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
      // Points only move through admin_adjust_points — a bare `users.points`
      // write left no points_ledger row, so balances drifted from history.
      const delta = typeof body.delta === 'number' ? body.delta : Number(body.delta)
      if (!Number.isInteger(delta) || delta === 0) {
        return NextResponse.json({ error: '積分變動必須是非零整數' }, { status: 400 })
      }
      if (reason.length < 5) {
        return NextResponse.json({ error: '原因至少要有 5 個字' }, { status: 400 })
      }

      const { data: rpcData, error: rpcError } = await service.rpc('admin_adjust_points', {
        p_user_id: id,
        p_delta: delta,
        p_note: reason,
        p_admin_id: admin.userId,
      })
      if (rpcError) {
        console.error('[admin/members] admin_adjust_points failed', rpcError)
        return NextResponse.json({ error: '積分調整失敗' }, { status: 500 })
      }
      const rpc = (rpcData ?? null) as { success?: boolean; code?: string; balance?: number } | null
      if (!rpc || rpc.success !== true) {
        return NextResponse.json(
          { error: `積分調整失敗（${rpc?.code ?? 'unknown'}）` },
          { status: 400 },
        )
      }
      return NextResponse.json({ success: true, balance: rpc.balance ?? null })
    } else if (body.action === 'adjust_credit') {
      // Credit only moves through admin_adjust_credit → wallet_apply. Writing
      // credits_ledger by hand skips users.credits and the wallet cap.
      const amount = typeof body.delta === 'number' ? body.delta : Number(body.delta)
      if (!Number.isInteger(amount) || amount === 0) {
        return NextResponse.json({ error: '金額變動必須是非零整數' }, { status: 400 })
      }
      if (reason.length < 5) {
        return NextResponse.json({ error: '原因至少要有 5 個字' }, { status: 400 })
      }

      const { data: rpcData, error: rpcError } = await service.rpc('admin_adjust_credit', {
        p_user_id: id,
        p_amount: amount,
        p_note: reason,
        p_admin_id: admin.userId,
      })
      if (rpcError) {
        console.error('[admin/members] admin_adjust_credit failed', rpcError)
        return NextResponse.json({ error: '錢包額度調整失敗' }, { status: 500 })
      }
      const rpc = (rpcData ?? null) as { success?: boolean; code?: string; balance?: number } | null
      if (!rpc || rpc.success !== true) {
        return NextResponse.json(
          { error: `錢包額度調整失敗（${rpc?.code ?? 'unknown'}）` },
          { status: 400 },
        )
      }
      return NextResponse.json({ success: true, balance: rpc.balance ?? null })
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

      await writeAdminActionLog({
        adminUserId: admin.userId,
        adminEmail: admin.email,
        actionType: 'member_message',
        targetTable: 'admin_notifications',
        targetId: id,
        beforeJsonb: null,
        afterJsonb: { title, reason },
        riskLevel: 'low',
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

    await writeAdminActionLog({
      adminUserId: admin.userId,
      adminEmail: admin.email,
      actionType: action,
      targetTable: 'users',
      targetId: id,
      beforeJsonb: beforeValue,
      afterJsonb: afterValue,
      riskLevel: 'medium',
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[admin/members] unexpected error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
