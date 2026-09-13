import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { applyTestPriceOverride, computeOverrideTotal } from './test-pricing'

// The point of these tests: prove a NORMAL booking can never read
// uat_test_pricing. The override moves real money on the production KPay
// merchant account, so "is_test === false means untouched" is the invariant that
// actually matters here, not the arithmetic.

type QueryResult = { data: unknown; error: { message: string } | null }

/**
 * Minimal service-client double that records which tables were queried, so a
 * test can assert the absence of a query rather than just the output value.
 */
function makeServiceStub(result: QueryResult) {
  const touchedTables: string[] = []
  const builder = {
    select: () => builder,
    eq: () => builder,
    order: () => builder,
    limit: () => builder,
    maybeSingle: () => Promise.resolve(result),
  }
  const client = {
    from: (table: string) => {
      touchedTables.push(table)
      return builder
    },
  }
  // The real client is a large generated type; this double only needs the one
  // method under test, hence the narrow cast at the boundary.
  return {
    client: client as unknown as Parameters<typeof applyTestPriceOverride>[0]['service'],
    touchedTables,
  }
}

const activeRow = {
  id: '11111111-1111-1111-1111-111111111111',
  mode: 'flat' as const,
  amount: 1,
  label: 'HK$1 smoke test',
  updated_at: '2026-09-12T00:00:00.000Z',
}

describe('applyTestPriceOverride — production safety', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('never queries uat_test_pricing for a non-test booking', async () => {
    const { client, touchedTables } = makeServiceStub({ data: activeRow, error: null })

    const outcome = await applyTestPriceOverride({
      service: client,
      isTest: false,
      total: 216,
      durationHours: 2,
      bookingId: 'b1',
    })

    expect(outcome.applied).toBe(false)
    expect(outcome.total).toBe(216)
    // The assertion that matters: no DB access at all on the normal path.
    expect(touchedTables).toEqual([])
  })

  it('returns the real total unchanged when no active row exists', async () => {
    const { client } = makeServiceStub({ data: null, error: null })

    const outcome = await applyTestPriceOverride({
      service: client,
      isTest: true,
      total: 216,
      durationHours: 2,
      bookingId: 'b2',
    })

    expect(outcome.applied).toBe(false)
    expect(outcome.total).toBe(216)
    if (!outcome.applied) expect(outcome.reason).toBe('no_active_row')
    // Falls back to the REAL price rather than 0 — never a silent free booking.
    expect(console.warn).toHaveBeenCalled()
  })

  it('falls back to the real total when the lookup errors', async () => {
    const { client } = makeServiceStub({ data: null, error: { message: 'boom' } })

    const outcome = await applyTestPriceOverride({
      service: client,
      isTest: true,
      total: 99,
      durationHours: 1,
      bookingId: 'b3',
    })

    expect(outcome.applied).toBe(false)
    expect(outcome.total).toBe(99)
  })

  it('applies a flat override regardless of duration', async () => {
    const { client } = makeServiceStub({ data: activeRow, error: null })

    const outcome = await applyTestPriceOverride({
      service: client,
      isTest: true,
      total: 216,
      durationHours: 3,
      bookingId: 'b4',
    })

    expect(outcome.applied).toBe(true)
    expect(outcome.total).toBe(1)
    if (outcome.applied) expect(outcome.originalTotal).toBe(216)
  })

  it('scales a per_hour override by billed hours', async () => {
    const { client } = makeServiceStub({
      data: { ...activeRow, mode: 'per_hour', amount: 2 },
      error: null,
    })

    const outcome = await applyTestPriceOverride({
      service: client,
      isTest: true,
      total: 216,
      durationHours: 2,
      bookingId: 'b5',
    })

    expect(outcome.applied).toBe(true)
    expect(outcome.total).toBe(4)
  })

  it('normalises a numeric amount returned as a string', async () => {
    const { client } = makeServiceStub({ data: { ...activeRow, amount: '3' }, error: null })

    const outcome = await applyTestPriceOverride({
      service: client,
      isTest: true,
      total: 216,
      durationHours: 1,
      bookingId: 'b6',
    })

    expect(outcome.applied).toBe(true)
    expect(outcome.total).toBe(3)
  })

  it('floors an override of 0 to HK$1 — KPay rejects zero-amount orders', async () => {
    const { client } = makeServiceStub({ data: { ...activeRow, amount: 0 }, error: null })

    const outcome = await applyTestPriceOverride({
      service: client,
      isTest: true,
      total: 216,
      durationHours: 1,
      bookingId: 'b7',
    })

    expect(outcome.applied).toBe(true)
    expect(outcome.total).toBe(1)
  })
})

describe('computeOverrideTotal', () => {
  it('ignores duration in flat mode', () => {
    expect(
      computeOverrideTotal({ id: 'x', mode: 'flat', amount: 5, label: null, updatedAt: '' }, 4),
    ).toBe(5)
  })

  it('multiplies by hours in per_hour mode', () => {
    expect(
      computeOverrideTotal({ id: 'x', mode: 'per_hour', amount: 5, label: null, updatedAt: '' }, 4),
    ).toBe(20)
  })

  it('treats a non-positive duration as one hour rather than zero', () => {
    expect(
      computeOverrideTotal({ id: 'x', mode: 'per_hour', amount: 5, label: null, updatedAt: '' }, 0),
    ).toBe(5)
  })
})
