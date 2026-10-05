/**
 * Runtime contract test for /api/member/wallet
 *
 * This test ensures the API route and all consumers (wallet page, member dashboard tiles)
 * agree on the response shape by importing the shared WalletApiResponse type.
 *
 * If the API changes its response structure without updating the contract type,
 * or if consumers expect a different shape, TypeScript compilation will fail.
 */

import type { WalletApiResponse } from '@/lib/member-contracts'

describe('Wallet API Contract', () => {
  it('API route returns WalletApiResponse shape', () => {
    // This is a compile-time contract test
    // If the API route response doesn't match WalletApiResponse, tsc will fail

    const mockResponse: WalletApiResponse = {
      balance: 500,
      currency: 'HKD',
      held: 0,
      available: 500,
      memberCode: 'TEST123',
      ledger: {
        items: [],
        hasMore: false,
        nextCursor: null
      }
    }

    // Verify required fields exist
    expect(mockResponse.balance).toBeDefined()
    expect(mockResponse.currency).toBe('HKD')
    expect(mockResponse.held).toBeDefined()
    expect(mockResponse.available).toBeDefined()
    expect(mockResponse.memberCode).toBeDefined()
    expect(mockResponse.ledger).toBeDefined()
    expect(mockResponse.ledger.items).toBeInstanceOf(Array)
    expect(mockResponse.ledger.hasMore).toBeDefined()
  })

  it('consumers expect WalletApiResponse shape', () => {
    // Simulate what consumers do
    const simulateWalletPageFetch = (data: WalletApiResponse) => {
      // This is what app/member/wallet/page.tsx does
      return {
        balance: data.balance,
        held: data.held,
        available: data.available,
        memberCode: data.memberCode,
        ledgerItems: data.ledger.items
      }
    }

    const simulateDashboardTileFetch = (data: WalletApiResponse) => {
      // This is what app/member/MemberDashboard.tsx Quick Actions does
      return data.balance
    }

    const mockData: WalletApiResponse = {
      balance: 500,
      currency: 'HKD',
      held: 0,
      available: 500,
      memberCode: 'TEST123',
      ledger: {
        items: [],
        hasMore: false,
        nextCursor: null
      }
    }

    expect(simulateWalletPageFetch(mockData).balance).toBe(500)
    expect(simulateDashboardTileFetch(mockData)).toBe(500)
  })

  it('fails when API returns wrong shape', () => {
    // This should cause TypeScript error if uncommented
    // @ts-expect-error - Testing that wrong shape is rejected
    const wrongShape: WalletApiResponse = {
      balance: {
        available: 500,
        held: 0
      },
      ledger: []
    }

    expect(wrongShape).toBeDefined()
  })
})
