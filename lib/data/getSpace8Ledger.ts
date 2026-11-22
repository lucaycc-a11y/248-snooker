// SPACE8 費用帳 data (service-role only; tables have RLS with no policies).
// space8_* tables are new and not yet in database.types.ts, so cast like getAppVersion.ts does.

import { unstable_noStore as noStore } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getServiceSupabase } from '@/lib/supabase/service'
import type { Space8Capital, Space8Claim, Space8Data, Space8Expense } from '@/lib/admin/space8Ledger'

const db = () => getServiceSupabase() as unknown as SupabaseClient

type ExpenseRow = { id: string; kind: string; spent_on: string; item: string; amount: number | string; paid_by: string; note: string | null }
type ClaimRow = { id: string; claimed_on: string; amount: number | string; paid_to: string; note: string | null }
type CapitalRow = { id: string; received_on: string; amount: number | string; note: string | null }

export async function getSpace8Ledger(): Promise<Space8Data> {
  noStore()
  const c = db()
  const [e, k, p] = await Promise.all([
    c.from('space8_expenses').select('id, kind, spent_on, item, amount, paid_by, note').order('spent_on', { ascending: true }).order('created_at', { ascending: true }),
    c.from('space8_claims').select('id, claimed_on, amount, paid_to, note').order('claimed_on', { ascending: true }).order('created_at', { ascending: true }),
    c.from('space8_capital').select('id, received_on, amount, note').order('received_on', { ascending: true }),
  ])
  if (e.error) throw new Error(`space8_expenses: ${e.error.message}`)
  if (k.error) throw new Error(`space8_claims: ${k.error.message}`)
  if (p.error) throw new Error(`space8_capital: ${p.error.message}`)

  const expenses: Space8Expense[] = ((e.data ?? []) as ExpenseRow[]).map((r) => ({
    id: r.id,
    kind: r.kind === 'ai' ? 'ai' : 'other',
    spentOn: r.spent_on,
    item: r.item,
    amount: Number(r.amount),
    paidBy: r.paid_by,
    note: r.note,
  }))
  const claims: Space8Claim[] = ((k.data ?? []) as ClaimRow[]).map((r) => ({
    id: r.id,
    claimedOn: r.claimed_on,
    amount: Number(r.amount),
    paidTo: r.paid_to,
    note: r.note,
  }))
  const capital: Space8Capital[] = ((p.data ?? []) as CapitalRow[]).map((r) => ({
    id: r.id,
    receivedOn: r.received_on,
    amount: Number(r.amount),
    note: r.note,
  }))
  return { expenses, claims, capital }
}
