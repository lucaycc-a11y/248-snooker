/**
 * AI tool definitions — §5.3.
 *
 * Read-only tools execute immediately and return data.
 * Write-propose tools return pending_action ONLY, never execute.
 */

import { getServiceSupabase } from '@/lib/supabase/service'
import { storePendingAction } from './aiSchema'
import { genId, str, num } from '@/lib/data/adminReadHelpers'

// ── Tool definitions (Anthropic tool_use format) ──────────────────────────

export const AI_TOOL_DEFINITIONS = [
  // ── Read-only tools ────────────────────────────────────────────────────
  {
    name: 'queryBookings',
    description:
      'Search bookings by status, date range, email, or booking reference. Returns up to 10 rows.',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: {
          type: 'string',
          description: 'Filter by status: confirmed, pending, cancelled, completed',
        },
        dateFrom: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        dateTo: { type: 'string', description: 'End date (YYYY-MM-DD)' },
        email: { type: 'string', description: 'Search by user email (partial match)' },
        reference: { type: 'string', description: 'Search by booking reference or human_code' },
      },
    },
  },
  {
    name: 'queryUserProfile',
    description:
      'Look up a user profile by userId, email, or phone. Returns user details including tier and activity.',
    input_schema: {
      type: 'object' as const,
      properties: {
        userId: { type: 'string', description: 'User ID (uuid)' },
        email: { type: 'string', description: 'User email' },
        phone: { type: 'string', description: 'User phone number' },
      },
    },
  },
  {
    name: 'queryPaymentLogs',
    description:
      'Search payment attempts by booking ID, status, or date range. Returns up to 10 rows.',
    input_schema: {
      type: 'object' as const,
      properties: {
        bookingId: { type: 'string', description: 'Filter by booking ID' },
        status: { type: 'string', description: 'Filter by payment status' },
        dateFrom: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        dateTo: { type: 'string', description: 'End date (YYYY-MM-DD)' },
      },
    },
  },
  {
    name: 'querySalesReport',
    description:
      'Get daily revenue and booking counts for a date range. Returns aggregated data.',
    input_schema: {
      type: 'object' as const,
      properties: {
        dateFrom: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        dateTo: { type: 'string', description: 'End date (YYYY-MM-DD)' },
      },
    },
  },

  // ── Write-propose tools (return pending_action ONLY) ────────────────────
  {
    name: 'proposeAddPoints',
    description:
      'Propose adding loyalty points to a user. Returns a pending action for admin confirmation.',
    input_schema: {
      type: 'object' as const,
      properties: {
        userId: { type: 'string', description: 'Target user ID' },
        points: { type: 'number', description: 'Points to add (positive integer)' },
        reason: { type: 'string', description: 'Reason for adding points' },
      },
      required: ['userId', 'points', 'reason'],
    },
  },
  {
    name: 'proposeCancelBooking',
    description:
      'Propose cancelling a booking with optional compensation. Returns a pending action for admin confirmation.',
    input_schema: {
      type: 'object' as const,
      properties: {
        bookingId: { type: 'string', description: 'Target booking ID' },
        reason: { type: 'string', description: 'Reason for cancellation' },
        compensationType: {
          type: 'string',
          enum: ['none', 'points', 'refund'],
          description: 'Type of compensation',
        },
        compensationValue: {
          type: 'number',
          description: 'Compensation value (points amount or refund HKD)',
        },
      },
      required: ['bookingId', 'reason'],
    },
  },
  {
    name: 'proposeCreateCoupon',
    description:
      'Propose creating a new coupon template. Returns a pending action for admin confirmation.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Coupon name' },
        discountType: {
          type: 'string',
          enum: ['percentage', 'fixed'],
          description: 'Discount type',
        },
        discountValue: { type: 'number', description: 'Discount value (percentage or HKD)' },
        maxUses: { type: 'number', description: 'Maximum number of uses' },
        validFrom: { type: 'string', description: 'Valid from date (YYYY-MM-DD)' },
        validUntil: { type: 'string', description: 'Valid until date (YYYY-MM-DD)' },
      },
      required: ['name', 'discountType', 'discountValue'],
    },
  },
  {
    name: 'proposeUpdateUserProfile',
    description:
      'Propose updating user profile fields. Returns a pending action for admin confirmation.',
    input_schema: {
      type: 'object' as const,
      properties: {
        userId: { type: 'string', description: 'Target user ID' },
        changes: {
          type: 'object',
          description: 'Fields to update (e.g., { displayName: "New Name", tier: "century" })',
        },
        reason: { type: 'string', description: 'Reason for the change' },
      },
      required: ['userId', 'changes', 'reason'],
    },
  },
  {
    name: 'proposeBlockUser',
    description:
      'Propose blocking a user account. Returns a pending action for admin confirmation.',
    input_schema: {
      type: 'object' as const,
      properties: {
        userId: { type: 'string', description: 'Target user ID' },
        reason: { type: 'string', description: 'Reason for blocking' },
      },
      required: ['userId', 'reason'],
    },
  },
] as const

// ── Tool execution ────────────────────────────────────────────────────────

type ToolInput = Record<string, unknown>

export async function executeReadTool(
  toolName: string,
  input: ToolInput
): Promise<{ result: unknown; error?: string }> {
  const service = getServiceSupabase()

  try {
    switch (toolName) {
      case 'queryBookings': {
        let query = service
          .from('bookings')
          .select('id, human_code, booking_reference, user_email, user_name, table_number, date, start_time, end_time, total_price, status, payment_method')
          .order('created_at', { ascending: false })
          .limit(10)

        if (input.status) query = query.eq('status', input.status)
        if (input.dateFrom) query = query.gte('date', input.dateFrom)
        if (input.dateTo) query = query.lte('date', input.dateTo)
        if (input.email) query = query.ilike('user_email', `%${input.email}%`)
        if (input.reference) {
          query = query.or(
            `human_code.ilike.%${input.reference}%,booking_reference.ilike.%${input.reference}%`
          )
        }

        const { data, error } = await query
        if (error) return { result: [], error: error.message }
        return { result: data ?? [] }
      }

      case 'queryUserProfile': {
        let query = service.from('users').select('*').limit(1)

        if (input.userId) query = query.eq('id', input.userId)
        else if (input.email) query = query.ilike('email', `%${input.email}%`)
        else if (input.phone) query = query.ilike('phone', `%${input.phone}%`)
        else return { result: null, error: 'Provide userId, email, or phone' }

        const { data, error } = await query.maybeSingle()
        if (error) return { result: null, error: error.message }
        return { result: data }
      }

      case 'queryPaymentLogs': {
        let query = service
          .from('payment_attempts')
          .select('id, booking_id, amount, status, provider_order_no, created_at')
          .order('created_at', { ascending: false })
          .limit(10)

        if (input.bookingId) query = query.eq('booking_id', input.bookingId)
        if (input.status) query = query.eq('status', input.status)
        if (input.dateFrom) query = query.gte('created_at', input.dateFrom)
        if (input.dateTo) query = query.lte('created_at', `${input.dateTo}T23:59:59`)

        const { data, error } = await query
        if (error) return { result: [], error: error.message }
        return { result: data ?? [] }
      }

      case 'querySalesReport': {
        const dateFrom = (input.dateFrom as string) ?? new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
        const dateTo = (input.dateTo as string) ?? new Date().toISOString().slice(0, 10)

        const { data, error } = await service
          .from('admin_revenue_daily')
          .select('*')
          .gte('date', dateFrom)
          .lte('date', dateTo)
          .order('date', { ascending: true })
          .limit(60)

        if (error) return { result: [], error: error.message }
        return { result: data ?? [] }
      }

      default:
        return { result: null, error: `Unknown tool: ${toolName}` }
    }
  } catch (err) {
    return { result: null, error: String(err) }
  }
}

export function executeWriteProposeTool(
  toolName: string,
  input: ToolInput,
  adminId: string
): { pendingActionId: string } | { error: string } {
  const actionId = genId('action')

  const riskLevel = toolName === 'proposeBlockUser' ? 'high' : 'medium'

  storePendingAction({
    id: actionId,
    type: toolName,
    adminId,
    payload: input,
    createdAt: Date.now(),
    confirmed: false,
  })

  return { pendingActionId: actionId }
}
