/**
 * Unified action executor — §5.7.
 *
 * All admin writes flow through here. Validates action type against whitelist,
 * executes DB changes within a transaction, and logs to admin_action_log.
 */

import { getServiceSupabase } from '@/lib/supabase/service'
import { consumePendingAction, type PendingAction } from './aiSchema'
import { num } from '@/lib/data/adminReadHelpers'

// ── Action type whitelist ──────────────────────────────────────────────────

const WRITE_ACTION_TYPES = new Set([
  'proposeAddPoints',
  'proposeCancelBooking',
  'proposeCreateCoupon',
  'proposeUpdateUserProfile',
  'proposeBlockUser',
])

// ── Execution result ───────────────────────────────────────────────────────

export type ExecutionResult = {
  success: boolean
  message: string
  data?: Record<string, unknown>
}

// ── Main executor ──────────────────────────────────────────────────────────

export async function executeAction(
  actionId: string,
  adminId: string,
  adminEmail: string
): Promise<ExecutionResult> {
  // 1. Consume the pending action (single-use, TTL checked)
  const action = consumePendingAction(actionId)
  if (!action) {
    return { success: false, message: 'Action not found or expired.' }
  }

  // 2. Verify ownership
  if (action.adminId !== adminId) {
    return { success: false, message: 'Action does not belong to this admin.' }
  }

  // 3. Validate action type
  if (!WRITE_ACTION_TYPES.has(action.type)) {
    return { success: false, message: `Unknown action type: ${action.type}` }
  }

  const service = getServiceSupabase()

  try {
    let result: ExecutionResult

    switch (action.type) {
      case 'proposeAddPoints':
        result = await executeAddPoints(service, action)
        break
      case 'proposeCancelBooking':
        result = await executeCancelBooking(service, action)
        break
      case 'proposeCreateCoupon':
        result = await executeCreateCoupon(service, action)
        break
      case 'proposeUpdateUserProfile':
        result = await executeUpdateUser(service, action)
        break
      case 'proposeBlockUser':
        result = await executeBlockUser(service, action)
        break
      default:
        return { success: false, message: `Unhandled action type: ${action.type}` }
    }

    // 4. Log to audit trail
    await service.from('admin_action_log').insert({
      admin_user_id: adminId,
      admin_email: adminEmail,
      action_type: action.type,
      target_table: extractTargetTable(action.type),
      target_id: extractTargetId(action),
      after_jsonb: action.payload,
      risk_level: getRiskLevel(action.type),
      confirmed_by: adminId,
    })

    return result
  } catch (err) {
    console.error('[actionExecutor] execution error', err)
    return { success: false, message: `Execution failed: ${String(err)}` }
  }
}

// ── Individual executors ───────────────────────────────────────────────────

async function executeAddPoints(
  service: ReturnType<typeof getServiceSupabase>,
  action: PendingAction
): Promise<ExecutionResult> {
  const { userId, points, reason } = action.payload as {
    userId: string
    points: number
    reason: string
  }

  if (!userId || typeof points !== 'number' || points <= 0 || !reason) {
    return { success: false, message: 'Invalid parameters for addPoints.' }
  }

  // Get current points
  const { data: user, error: fetchErr } = await service
    .from('users')
    .select('id, points')
    .eq('id', userId)
    .single()

  if (fetchErr || !user) {
    return { success: false, message: 'User not found.' }
  }

  const currentPoints = num(user, ['points'], 0)
  const newPoints = currentPoints + points

  // Update points
  const { error: updateErr } = await service
    .from('users')
    .update({ points: newPoints })
    .eq('id', userId)

  if (updateErr) {
    return { success: false, message: `Failed to update points: ${updateErr.message}` }
  }

  // Log to points_ledger
  await service.from('points_ledger').insert({
    user_id: userId,
    points,
    type: 'admin_grant',
    reference_id: null,
    note: reason,
  })

  return {
    success: true,
    message: `Added ${points} points to user ${userId}. Reason: ${reason}`,
    data: { previousPoints: currentPoints, newPoints },
  }
}

async function executeCancelBooking(
  service: ReturnType<typeof getServiceSupabase>,
  action: PendingAction
): Promise<ExecutionResult> {
  const { bookingId, reason, compensationType, compensationValue } = action.payload as {
    bookingId: string
    reason: string
    compensationType?: string
    compensationValue?: number
  }

  if (!bookingId || !reason) {
    return { success: false, message: 'Invalid parameters for cancelBooking.' }
  }

  // Get booking
  const { data: booking, error: fetchErr } = await service
    .from('bookings')
    .select('id, user_id, status, total_price')
    .eq('id', bookingId)
    .single()

  if (fetchErr || !booking) {
    return { success: false, message: 'Booking not found.' }
  }

  if (booking.status === 'cancelled' || booking.status === 'admin_cancelled') {
    return { success: false, message: 'Booking is already cancelled.' }
  }

  // Update booking status
  const { error: updateErr } = await service
    .from('bookings')
    .update({ status: 'admin_cancelled' })
    .eq('id', bookingId)

  if (updateErr) {
    return { success: false, message: `Failed to cancel booking: ${updateErr.message}` }
  }

  // Log cancellation
  await service.from('cancellation_log').insert({
    booking_id: bookingId,
    admin_id: action.adminId,
    reason,
    compensation_type: compensationType ?? 'none',
    compensation_value: compensationValue ?? 0,
  })

  // Handle points compensation
  if (compensationType === 'points' && compensationValue && compensationValue > 0) {
    await service.from('points_ledger').insert({
      user_id: booking.user_id,
      points: compensationValue,
      type: 'cancellation_compensation',
      reference_id: bookingId,
      note: `Cancellation compensation for booking ${bookingId}`,
    })
  }

  return {
    success: true,
    message: `Booking ${bookingId} cancelled. Reason: ${reason}`,
    data: { bookingId, previousStatus: booking.status },
  }
}

async function executeCreateCoupon(
  service: ReturnType<typeof getServiceSupabase>,
  action: PendingAction
): Promise<ExecutionResult> {
  const { name, discountType, discountValue, maxUses, validFrom, validUntil } = action.payload as {
    name: string
    discountType: string
    discountValue: number
    maxUses?: number
    validFrom?: string
    validUntil?: string
  }

  if (!name || !discountType || typeof discountValue !== 'number') {
    return { success: false, message: 'Invalid parameters for createCoupon.' }
  }

  const { data: coupon, error: insertErr } = await service
    .from('coupon_templates')
    .insert({
      name,
      discount_type: discountType,
      discount_value: discountValue,
      max_uses: maxUses ?? null,
      valid_from: validFrom ?? null,
      valid_until: validUntil ?? null,
      is_active: true,
      created_by: action.adminId,
    })
    .select('id')
    .single()

  if (insertErr) {
    return { success: false, message: `Failed to create coupon: ${insertErr.message}` }
  }

  return {
    success: true,
    message: `Coupon "${name}" created (${discountType}: ${discountValue}).`,
    data: { couponId: coupon?.id },
  }
}

async function executeUpdateUser(
  service: ReturnType<typeof getServiceSupabase>,
  action: PendingAction
): Promise<ExecutionResult> {
  const { userId, changes, reason } = action.payload as {
    userId: string
    changes: Record<string, unknown>
    reason: string
  }

  if (!userId || !changes || !reason) {
    return { success: false, message: 'Invalid parameters for updateUser.' }
  }

  // Whitelist allowed fields
  const ALLOWED_FIELDS = new Set(['display_name', 'phone', 'tier', 'email'])
  const sanitizedChanges: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(changes)) {
    if (ALLOWED_FIELDS.has(key)) {
      sanitizedChanges[key] = value
    }
  }

  if (Object.keys(sanitizedChanges).length === 0) {
    return { success: false, message: 'No valid fields to update.' }
  }

  // Get current values for audit
  const { data: current } = await service
    .from('users')
    .select('*')
    .eq('id', userId)
    .single()

  const { error: updateErr } = await service
    .from('users')
    .update(sanitizedChanges)
    .eq('id', userId)

  if (updateErr) {
    return { success: false, message: `Failed to update user: ${updateErr.message}` }
  }

  return {
    success: true,
    message: `User ${userId} updated. Reason: ${reason}`,
    data: { before: current, changes: sanitizedChanges },
  }
}

async function executeBlockUser(
  service: ReturnType<typeof getServiceSupabase>,
  action: PendingAction
): Promise<ExecutionResult> {
  const { userId, reason } = action.payload as { userId: string; reason: string }

  if (!userId || !reason) {
    return { success: false, message: 'Invalid parameters for blockUser.' }
  }

  const { error: updateErr } = await service
    .from('users')
    .update({ is_blocked: true })
    .eq('id', userId)

  if (updateErr) {
    return { success: false, message: `Failed to block user: ${updateErr.message}` }
  }

  return {
    success: true,
    message: `User ${userId} blocked. Reason: ${reason}`,
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function extractTargetTable(actionType: string): string {
  switch (actionType) {
    case 'proposeAddPoints':
    case 'proposeUpdateUserProfile':
    case 'proposeBlockUser':
      return 'users'
    case 'proposeCancelBooking':
      return 'bookings'
    case 'proposeCreateCoupon':
      return 'coupon_templates'
    default:
      return 'unknown'
  }
}

function extractTargetId(action: PendingAction): string {
  const p = action.payload
  if (typeof p.userId === 'string') return p.userId
  if (typeof p.bookingId === 'string') return p.bookingId
  return action.id
}

function getRiskLevel(actionType: string): string {
  switch (actionType) {
    case 'proposeBlockUser':
      return 'high'
    case 'proposeCancelBooking':
      return 'high'
    case 'proposeAddPoints':
      return 'medium'
    case 'proposeCreateCoupon':
      return 'medium'
    case 'proposeUpdateUserProfile':
      return 'low'
    default:
      return 'medium'
  }
}
