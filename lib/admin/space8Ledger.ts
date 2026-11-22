// SPACE8 費用帳 — pure types + summary maths, shared by the page, the PDF and the API.
// Claims (向公司申請返還) are NOT expenses: they only reduce what is still owed to each payer.

export type Space8Expense = {
  id: string
  kind: 'ai' | 'other'
  spentOn: string // YYYY-MM-DD
  item: string
  amount: number
  paidBy: string
  note: string | null
}

export type Space8Claim = {
  id: string
  claimedOn: string // YYYY-MM-DD
  amount: number
  paidTo: string
  note: string | null
}

export type Space8Capital = { id: string; receivedOn: string; amount: number; note: string | null }

export type Space8Data = { expenses: Space8Expense[]; claims: Space8Claim[]; capital: Space8Capital[] }

export type PayerRow = { name: string; paid: number; claimed: number; outstanding: number; claimPct: number }
export type MonthRow = { month: string; ai: number; other: number; total: number; cumulative: number }
export type ItemRow = { item: string; entries: number; amount: number; pct: number; avg: number }

export type Space8Summary = {
  capital: number
  aiTotal: number
  otherTotal: number
  expenseTotal: number
  balance: number
  capitalSpentPct: number
  claimedTotal: number
  outstandingTotal: number
  claimPct: number
  payers: PayerRow[]
  months: MonthRow[]
  items: ItemRow[]
}

/** Payers that always show, even before their first entry. */
export const DEFAULT_PAYERS = ['Luca Y.', 'Keri L.', 'Alvin Y.'] as const

const round2 = (n: number) => Math.round(n * 100) / 100
const pct = (part: number, whole: number) => (whole > 0 ? part / whole : 0)

export function summarise(data: Space8Data): Space8Summary {
  const capital = round2(data.capital.reduce((s, c) => s + c.amount, 0))
  const aiTotal = round2(data.expenses.filter((e) => e.kind === 'ai').reduce((s, e) => s + e.amount, 0))
  const otherTotal = round2(data.expenses.filter((e) => e.kind === 'other').reduce((s, e) => s + e.amount, 0))
  const expenseTotal = round2(aiTotal + otherTotal)
  const claimedTotal = round2(data.claims.reduce((s, c) => s + c.amount, 0))

  const names = new Set<string>(DEFAULT_PAYERS)
  for (const e of data.expenses) names.add(e.paidBy)
  for (const c of data.claims) names.add(c.paidTo)
  const payers: PayerRow[] = [...names].map((name) => {
    const paid = round2(data.expenses.filter((e) => e.paidBy === name).reduce((s, e) => s + e.amount, 0))
    const claimed = round2(data.claims.filter((c) => c.paidTo === name).reduce((s, c) => s + c.amount, 0))
    return { name, paid, claimed, outstanding: round2(paid - claimed), claimPct: pct(claimed, paid) }
  })

  const byMonth = new Map<string, { ai: number; other: number }>()
  for (const e of data.expenses) {
    const m = e.spentOn.slice(0, 7)
    const cur = byMonth.get(m) ?? { ai: 0, other: 0 }
    cur[e.kind] += e.amount
    byMonth.set(m, cur)
  }
  let running = 0
  const months: MonthRow[] = [...byMonth.keys()].sort().map((month) => {
    const v = byMonth.get(month) ?? { ai: 0, other: 0 }
    const total = round2(v.ai + v.other)
    running = round2(running + total)
    return { month, ai: round2(v.ai), other: round2(v.other), total, cumulative: running }
  })

  const byItem = new Map<string, { entries: number; amount: number }>()
  for (const e of data.expenses.filter((x) => x.kind === 'other')) {
    const cur = byItem.get(e.item) ?? { entries: 0, amount: 0 }
    cur.entries += 1
    cur.amount += e.amount
    byItem.set(e.item, cur)
  }
  const items: ItemRow[] = [...byItem.entries()]
    .map(([item, v]) => ({ item, entries: v.entries, amount: round2(v.amount), pct: pct(v.amount, otherTotal), avg: round2(v.amount / v.entries) }))
    .sort((a, b) => b.amount - a.amount)

  return {
    capital,
    aiTotal,
    otherTotal,
    expenseTotal,
    balance: round2(capital - expenseTotal),
    capitalSpentPct: pct(expenseTotal, capital),
    claimedTotal,
    outstandingTotal: round2(expenseTotal - claimedTotal),
    claimPct: pct(claimedTotal, expenseTotal),
    payers,
    months,
    items,
  }
}

export const hkd = (n: number): string =>
  `HK$${n.toLocaleString('en-US', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`

export const isDateStr = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v))
