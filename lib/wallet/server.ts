/**
 * Wallet and points data access layer (server-side, RLS enforced).
 */

import { createClient } from '@/lib/supabase/server'

export type WalletSummary = {
  credits: number // HK$, whole dollars
  lifetimePoints: number // users.points
  redeemablePoints: number // points - points_converted
  convertedPoints: number // users.points_converted
  tier: string // 'amateur' | 'century' | 'maximum'
}

export type CreditLedgerEntry = {
  amount: number // signed HK$
  type: 'convert' | 'signup' | 'topup' | 'redeem' | 'refund' | 'reversal' | 'manual'
  note: string | null
  balanceAfter: number
  createdAt: string
}

export type PointsLedgerEntry = {
  points: number // signed
  type: string
  note: string | null
  createdAt: string | null
}

export async function getWalletSummary(userId: string): Promise<WalletSummary | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('users')
    .select('credits, points, points_converted, tier')
    .eq('id', userId)
    .maybeSingle()

  if (error || !data) {
    console.warn('[wallet] user not found:', userId)
    return null
  }

  return {
    credits: data.credits || 0,
    lifetimePoints: data.points || 0,
    redeemablePoints: Math.max(0, (data.points || 0) - (data.points_converted || 0)),
    convertedPoints: data.points_converted || 0,
    tier: data.tier || 'amateur',
  }
}

export async function getCreditLedger(
  userId: string,
  page = 0,
  pageSize = 20,
): Promise<CreditLedgerEntry[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('credits_ledger')
    .select('amount, type, note, balance_after, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1)

  if (error) {
    console.warn('[wallet] ledger query failed:', error.message)
    return []
  }

  return (data || []).map((row) => ({
    amount: row.amount,
    type: row.type as CreditLedgerEntry['type'],
    note: row.note,
    balanceAfter: row.balance_after,
    createdAt: row.created_at,
  }))
}

export async function getPointsLedger(
  userId: string,
  page = 0,
  pageSize = 20,
): Promise<PointsLedgerEntry[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('points_ledger')
    .select('points, type, note, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1)

  if (error) {
    console.warn('[wallet] points ledger query failed:', error.message)
    return []
  }

  return (data || []).map((row) => ({
    points: row.points,
    type: row.type as PointsLedgerEntry['type'],
    note: row.note,
    createdAt: row.created_at,
  }))
}
