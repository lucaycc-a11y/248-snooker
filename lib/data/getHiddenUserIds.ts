import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'

// Hidden accounts (admin/test/ops users) are excluded from every member-facing
// list and every total. The filter is applied HERE, once, in the shared server
// loaders — never in the browser, and never twice on the same row set.
//
// A failure to read this table must NOT degrade into "show everything": that
// would leak admin accounts into member lists and revenue totals. Callers
// already wrap their loaders in try/catch and surface `error`, so we throw.

export type HiddenUserList = {
  /** user_id values that must be excluded from lists and totals. */
  ids: Set<string>
  /** Reason per hidden user, for the 「已隱藏」 badge tooltip. */
  reasons: Map<string, string>
}

/** One row of GET /api/admin/hidden-users. */
export type HiddenUserRow = {
  userId: string
  email: string | null
  displayName: string | null
  memberCode: string | null
  reason: string | null
  createdAt: string | null
}

const EMPTY: HiddenUserList = { ids: new Set(), reasons: new Map() }

export async function getHiddenUserList(): Promise<HiddenUserList> {
  const service = getLegacyServiceSupabase()
  const { data, error } = await service
    .from('admin_hidden_users')
    .select('user_id, reason')
  if (error) {
    throw new Error(`隱藏帳戶清單載入失敗：${error.message}`)
  }
  if (!data || data.length === 0) return EMPTY

  const ids = new Set<string>()
  const reasons = new Map<string, string>()
  for (const row of data as { user_id: string; reason: string | null }[]) {
    if (typeof row.user_id !== 'string' || row.user_id.length === 0) continue
    ids.add(row.user_id)
    if (typeof row.reason === 'string' && row.reason.length > 0) {
      reasons.set(row.user_id, row.reason)
    }
  }
  return { ids, reasons }
}

/**
 * PostgREST `.not('id','in',…)` needs a parenthesised CSV. An empty set must
 * skip the filter entirely — `.not('id','in','()')` is a syntax error.
 */
export function hiddenIdFilterValue(ids: Set<string>): string | null {
  if (ids.size === 0) return null
  return `(${[...ids].join(',')})`
}
