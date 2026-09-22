// ─────────────────────────────────────────────────────────────────
// Payment amount reconciliation utilities
//
// Ensures that the amount captured by the payment provider matches the
// amount the booking requires. Catches discrepancies at create-intent
// and webhook/confirmation stages to prevent under/overpayment issues.
// ─────────────────────────────────────────────────────────────────

export interface AmountCheckResult {
  matches: boolean
  requiredCents: number
  actualCents: number
  discrepancyCents?: number
  scenario?: 'underpaid' | 'overpaid'
}

/**
 * Compare the actual amount captured/authorized against the booking's required total.
 * Returns detailed mismatch information for logging and user messaging.
 */
export function checkAmountMatch(
  requiredAmount: number, // booking total_price in HKD
  actualAmountCents: number, // amount from PaymentIntent/charge in cents
): AmountCheckResult {
  const requiredCents = Math.round(requiredAmount * 100)

  if (requiredCents === actualAmountCents) {
    return {
      matches: true,
      requiredCents,
      actualCents: actualAmountCents,
    }
  }

  const discrepancyCents = actualAmountCents - requiredCents
  const scenario = discrepancyCents > 0 ? 'overpaid' : 'underpaid'

  return {
    matches: false,
    requiredCents,
    actualCents: actualAmountCents,
    discrepancyCents,
    scenario,
  }
}

/**
 * Log an amount mismatch with full context for support/ops follow-up.
 */
export function logAmountMismatch(
  stage: 'create-intent' | 'webhook' | 'polling',
  context: {
    bookingId: string
    providerOrderNo?: string
    userId?: string
    requiredCents: number
    actualCents: number
    scenario: 'underpaid' | 'overpaid'
    discrepancyCents: number
  },
) {
  console.error(`[AmountMismatch] ${stage}`, {
    bookingId: context.bookingId,
    providerOrderNo: context.providerOrderNo,
    userId: context.userId,
    requiredCents: context.requiredCents,
    actualCents: context.actualCents,
    scenario: context.scenario,
    discrepancyCents: context.discrepancyCents,
    requiredHKD: (context.requiredCents / 100).toFixed(2),
    actualHKD: (context.actualCents / 100).toFixed(2),
    discrepancyHKD: (Math.abs(context.discrepancyCents) / 100).toFixed(2),
  })
}
