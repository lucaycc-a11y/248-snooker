/**
 * AI structured JSON response schema — §5.
 *
 * All AI responses must conform to one of these types. The server validates
 * the response against this schema before returning to the client. If
 * validation fails, a fallback message is returned instead.
 */

// ── Response types ─────────────────────────────────────────────────────────

export type AIResponseSummary = {
  type: 'summary'
  content: string
}

export type AIResponseList = {
  type: 'list'
  items: string[]
}

export type AIResponseTable = {
  type: 'table'
  headers: string[]
  rows: string[][]
}

export type AIResponsePendingAction = {
  type: 'pending_action'
  actionId: string
  actionType: string
  targetSummary: string
  changes: Array<{ field: string; before: string; after: string }>
  reason: string
  riskLevel: 'low' | 'medium' | 'high'
}

export type AIResponsePlainText = {
  type: 'plain_text'
  content: string
}

export type AIResponse =
  | AIResponseSummary
  | AIResponseList
  | AIResponseTable
  | AIResponsePendingAction
  | AIResponsePlainText

// ── Tool call types ────────────────────────────────────────────────────────

export type ToolCallResult = {
  tool: string
  data: unknown
}

// ── Pending action storage ─────────────────────────────────────────────────

export type PendingAction = {
  id: string
  type: string
  adminId: string
  payload: Record<string, unknown>
  createdAt: number
  confirmed: boolean
}

// In-memory store for pending actions (5-min TTL, single-use).
// Production: use Redis. This works for single-instance deployments.
const pendingActions = new Map<string, PendingAction>()

const ACTION_TTL_MS = 5 * 60 * 1000 // 5 minutes

export function storePendingAction(action: PendingAction): void {
  // Clean expired entries on write
  const now = Date.now()
  for (const [key, val] of pendingActions) {
    if (now - val.createdAt > ACTION_TTL_MS) {
      pendingActions.delete(key)
    }
  }
  pendingActions.set(action.id, action)
}

export function getPendingAction(id: string): PendingAction | undefined {
  const action = pendingActions.get(id)
  if (!action) return undefined

  // Check TTL
  if (Date.now() - action.createdAt > ACTION_TTL_MS) {
    pendingActions.delete(id)
    return undefined
  }

  return action
}

export function consumePendingAction(id: string): PendingAction | undefined {
  const action = getPendingAction(id)
  if (action) {
    pendingActions.delete(id) // Single-use
  }
  return action
}

// ── Validation ─────────────────────────────────────────────────────────────

const FALLBACK_RESPONSE: AIResponsePlainText = {
  type: 'plain_text',
  content: "I couldn't process that request. Please try rephrasing.",
}

export function validateAIResponse(raw: unknown): AIResponse {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return FALLBACK_RESPONSE
  }

  const obj = raw as Record<string, unknown>
  const type = obj.type

  if (type === 'summary' && typeof obj.content === 'string') {
    return { type: 'summary', content: obj.content }
  }

  if (
    type === 'list' &&
    Array.isArray(obj.items) &&
    obj.items.every((item: unknown) => typeof item === 'string')
  ) {
    return { type: 'list', items: obj.items as string[] }
  }

  if (
    type === 'table' &&
    Array.isArray(obj.headers) &&
    obj.headers.every((h: unknown) => typeof h === 'string') &&
    Array.isArray(obj.rows) &&
    obj.rows.every(
      (row: unknown) =>
        Array.isArray(row) && row.every((cell: unknown) => typeof cell === 'string')
    )
  ) {
    return {
      type: 'table',
      headers: obj.headers as string[],
      rows: obj.rows as string[][],
    }
  }

  if (
    type === 'pending_action' &&
    typeof obj.actionId === 'string' &&
    typeof obj.actionType === 'string' &&
    typeof obj.targetSummary === 'string' &&
    Array.isArray(obj.changes) &&
    typeof obj.reason === 'string' &&
    (obj.riskLevel === 'low' || obj.riskLevel === 'medium' || obj.riskLevel === 'high')
  ) {
    return {
      type: 'pending_action',
      actionId: obj.actionId,
      actionType: obj.actionType,
      targetSummary: obj.targetSummary,
      changes: obj.changes as Array<{ field: string; before: string; after: string }>,
      reason: obj.reason,
      riskLevel: obj.riskLevel as 'low' | 'medium' | 'high',
    }
  }

  if (type === 'plain_text' && typeof obj.content === 'string') {
    return { type: 'plain_text', content: obj.content }
  }

  // If it looks like a plain text response without type wrapper
  if (typeof obj.content === 'string') {
    return { type: 'plain_text', content: obj.content }
  }

  return FALLBACK_RESPONSE
}
