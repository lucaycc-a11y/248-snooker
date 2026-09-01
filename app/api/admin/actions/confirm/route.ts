/**
 * Action confirmation API — §5.7.
 *
 * POST with { actionId } to confirm a pending AI-proposed write action.
 * High-risk actions (cancel booking, block user) require re-verification.
 */

import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { executeAction, type ExecutionResult } from '@/lib/admin/actionExecutor'
import { getPendingAction } from '@/lib/admin/aiSchema'
import { rateLimit } from '@/lib/rate-limit'

type ConfirmBody = {
  actionId: string
}

// High-risk action types that require additional verification
const HIGH_RISK_ACTIONS = new Set([
  'proposeCancelBooking',
  'proposeBlockUser',
])

export async function POST(req: Request) {
  try {
    // ── Auth ─────────────────────────────────────────────────────────────
    const admin = await getAdminData()
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ── Rate limit: 5 confirms per hour per admin ──────────────────────
    const allowed = await rateLimit('admin_action_confirm', `user:${admin.userId}`, 5, 3600)
    if (!allowed) {
      return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
    }

    // ── Parse body ─────────────────────────────────────────────────────
    const body: unknown = await req.json()
    if (!body || typeof body !== 'object' || typeof (body as ConfirmBody).actionId !== 'string') {
      return NextResponse.json(
        { error: 'Invalid request: actionId (string) is required.' },
        { status: 400 }
      )
    }

    const { actionId } = body as ConfirmBody

    // ── Check action exists and is valid (before executing) ────────────
    const pendingAction = getPendingAction(actionId)
    if (!pendingAction) {
      return NextResponse.json(
        { error: 'Action not found or expired. Actions expire after 5 minutes.' },
        { status: 404 }
      )
    }

    // ── Verify ownership ───────────────────────────────────────────────
    if (pendingAction.adminId !== admin.userId) {
      return NextResponse.json(
        { error: 'This action belongs to a different admin.' },
        { status: 403 }
      )
    }

    // ── High-risk: require explicit confirmation via header ─────────────
    const isHighRisk = HIGH_RISK_ACTIONS.has(pendingAction.type)
    const confirmHeader = req.headers.get('x-confirm-high-risk')
    if (isHighRisk && confirmHeader !== 'true') {
      return NextResponse.json(
        {
          error: 'high_risk_requires_confirmation',
          message: 'This action is high-risk. Set x-confirm-high-risk: true header to proceed.',
          actionType: pendingAction.type,
          targetSummary: pendingAction.payload,
        },
        { status: 428 }
      )
    }

    // ── Execute ────────────────────────────────────────────────────────
    const result: ExecutionResult = await executeAction(
      actionId,
      admin.userId,
      admin.email
    )

    if (!result.success) {
      return NextResponse.json(
        { error: result.message },
        { status: 422 }
      )
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      data: result.data,
    })
  } catch (err) {
    console.error('[actions/confirm] POST error', err)
    return NextResponse.json(
      { error: 'Internal error confirming action.' },
      { status: 500 }
    )
  }
}
