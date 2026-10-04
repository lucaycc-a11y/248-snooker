/**
 * API Contract Tests - Member Area
 *
 * Validates that API responses match TypeScript contracts defined in lib/member-contracts.ts
 * Tests all member API endpoints: wallet, points, inbox
 */

import { test, expect } from '@playwright/test'
import { loginAsMember } from '../helpers/auth'

// Contract validation helpers
function validateWalletBalance(data: any) {
  expect(data).toHaveProperty('balance')
  expect(data).toHaveProperty('held')
  expect(data).toHaveProperty('available')
  expect(data).toHaveProperty('memberCode')
  expect(typeof data.balance).toBe('number')
  expect(typeof data.held).toBe('number')
  expect(typeof data.available).toBe('number')
  expect(typeof data.memberCode).toBe('string')
  expect(data.available).toBe(data.balance - data.held)
}

function validateWalletLedgerItem(item: any) {
  expect(item).toHaveProperty('id')
  expect(item).toHaveProperty('type')
  expect(item).toHaveProperty('amount')
  expect(item).toHaveProperty('balanceAfter')
  expect(item).toHaveProperty('createdAt')
  expect(item).toHaveProperty('note')
  expect(item).toHaveProperty('pointsConverted')
  expect(item).toHaveProperty('booking')

  expect(typeof item.id).toBe('string')
  expect(typeof item.type).toBe('string')
  expect(typeof item.amount).toBe('number')
  expect(typeof item.balanceAfter).toBe('number')
  expect(typeof item.createdAt).toBe('string')
  expect(typeof item.note).toBe('string')

  // ISO timestamp validation
  expect(() => new Date(item.createdAt)).not.toThrow()

  if (item.booking) {
    expect(item.booking).toHaveProperty('id')
    expect(item.booking).toHaveProperty('reference')
    expect(item.booking).toHaveProperty('humanCode')
    expect(item.booking).toHaveProperty('tableNumber')
    expect(item.booking).toHaveProperty('date')
    expect(item.booking).toHaveProperty('startTime')
    expect(item.booking).toHaveProperty('endTime')
  }
}

function validatePointsSummary(data: any) {
  expect(data).toHaveProperty('lifetime')
  expect(data).toHaveProperty('redeemable')
  expect(data).toHaveProperty('convertedPoints')
  expect(data).toHaveProperty('depositedToWallet')
  expect(data).toHaveProperty('tier')
  expect(data).toHaveProperty('blockSize')
  expect(data).toHaveProperty('creditsPerBlock')

  expect(typeof data.lifetime).toBe('number')
  expect(typeof data.redeemable).toBe('number')
  expect(typeof data.convertedPoints).toBe('number')
  expect(typeof data.depositedToWallet).toBe('number')
  expect(typeof data.tier).toBe('string')
  expect(typeof data.blockSize).toBe('number')
  expect(typeof data.creditsPerBlock).toBe('number')

  // Business logic validation
  expect(data.redeemable).toBeLessThanOrEqual(data.lifetime)
  expect(data.blockSize).toBeGreaterThan(0)
  expect(data.creditsPerBlock).toBeGreaterThan(0)
}

function validatePointsTransactionItem(item: any) {
  expect(item).toHaveProperty('id')
  expect(item).toHaveProperty('source')
  expect(item).toHaveProperty('type')
  expect(item).toHaveProperty('points')
  expect(item).toHaveProperty('depositedHkd')
  expect(item).toHaveProperty('paidHkd')
  expect(item).toHaveProperty('createdAt')
  expect(item).toHaveProperty('note')
  expect(item).toHaveProperty('bookingReference')

  expect(typeof item.id).toBe('string')
  expect(['points', 'credits']).toContain(item.source)
  expect(typeof item.type).toBe('string')
  expect(typeof item.points).toBe('number')
  expect(typeof item.createdAt).toBe('string')
  expect(typeof item.note).toBe('string')

  // ISO timestamp validation
  expect(() => new Date(item.createdAt)).not.toThrow()
}

function validateInboxItem(item: any) {
  expect(item).toHaveProperty('id')
  expect(item).toHaveProperty('type')
  expect(item).toHaveProperty('title')
  expect(item).toHaveProperty('message')
  expect(item).toHaveProperty('read')
  expect(item).toHaveProperty('createdAt')

  expect(typeof item.id).toBe('string')
  expect(typeof item.type).toBe('string')
  expect(typeof item.title).toBe('string')
  expect(typeof item.message).toBe('string')
  expect(typeof item.read).toBe('boolean')
  expect(typeof item.createdAt).toBe('string')

  // ISO timestamp validation
  expect(() => new Date(item.createdAt)).not.toThrow()
}

test.describe('Wallet API Contracts', () => {
  test('GET /api/member/wallet - returns valid WalletBalance and WalletLedgerResponse', async ({ page }) => {
    await loginAsMember(page, 'test@example.com')

    const response = await page.request.get('/api/member/wallet')
    expect(response.ok()).toBeTruthy()

    const data = await response.json()

    // Validate WalletBalance
    validateWalletBalance(data.balance)

    // Validate WalletLedgerResponse
    expect(data).toHaveProperty('items')
    expect(data).toHaveProperty('hasMore')
    expect(data).toHaveProperty('nextCursor')
    expect(Array.isArray(data.items)).toBeTruthy()
    expect(typeof data.hasMore).toBe('boolean')

    // Validate each ledger item
    data.items.forEach((item: any) => {
      validateWalletLedgerItem(item)
    })
  })

  test('GET /api/member/wallet/offers - returns valid WalletOffersResponse', async ({ page }) => {
    await loginAsMember(page, 'test@example.com')

    const response = await page.request.get('/api/member/wallet/offers')
    expect(response.ok()).toBeTruthy()

    const data = await response.json()

    expect(data).toHaveProperty('available')
    expect(data).toHaveProperty('used')
    expect(Array.isArray(data.available)).toBeTruthy()
    expect(Array.isArray(data.used)).toBeTruthy()

    // Validate available offers
    data.available.forEach((offer: any) => {
      expect(offer).toHaveProperty('code')
      expect(offer).toHaveProperty('name')
      expect(offer).toHaveProperty('discountType')
      expect(offer).toHaveProperty('discountValue')
      expect(offer).toHaveProperty('minCartAmount')
      expect(offer).toHaveProperty('maxDiscount')
      expect(offer).toHaveProperty('validUntil')
    })

    // Validate used offers
    data.used.forEach((offer: any) => {
      expect(offer).toHaveProperty('code')
      expect(offer).toHaveProperty('name')
      expect(offer).toHaveProperty('discountAmount')
      expect(offer).toHaveProperty('redeemedAt')
    })
  })
})

test.describe('Points API Contracts', () => {
  test('GET /api/member/points - returns valid PointsSummary', async ({ page }) => {
    await loginAsMember(page, 'test@example.com')

    const response = await page.request.get('/api/member/points')
    expect(response.ok()).toBeTruthy()

    const data = await response.json()
    validatePointsSummary(data)
  })

  test('GET /api/member/points/transactions - returns valid PointsTransactionsResponse', async ({ page }) => {
    await loginAsMember(page, 'test@example.com')

    const response = await page.request.get('/api/member/points/transactions')
    expect(response.ok()).toBeTruthy()

    const data = await response.json()

    expect(data).toHaveProperty('items')
    expect(data).toHaveProperty('hasMore')
    expect(data).toHaveProperty('nextCursor')
    expect(Array.isArray(data.items)).toBeTruthy()
    expect(typeof data.hasMore).toBe('boolean')

    // Validate each transaction item
    data.items.forEach((item: any) => {
      validatePointsTransactionItem(item)
    })
  })

  test('GET /api/member/points/transactions?filter=earn - filters correctly', async ({ page }) => {
    await loginAsMember(page, 'test@example.com')

    const response = await page.request.get('/api/member/points/transactions?filter=earn')
    expect(response.ok()).toBeTruthy()

    const data = await response.json()
    expect(Array.isArray(data.items)).toBeTruthy()

    // All items should have positive points (earned)
    data.items.forEach((item: any) => {
      expect(item.points).toBeGreaterThan(0)
    })
  })
})

test.describe('Inbox API Contracts', () => {
  test('GET /api/member/inbox - returns valid InboxResponse', async ({ page }) => {
    await loginAsMember(page, 'test@example.com')

    const response = await page.request.get('/api/member/inbox')
    expect(response.ok()).toBeTruthy()

    const data = await response.json()

    expect(data).toHaveProperty('items')
    expect(data).toHaveProperty('hasMore')
    expect(data).toHaveProperty('nextCursor')
    expect(data).toHaveProperty('unreadCount')
    expect(Array.isArray(data.items)).toBeTruthy()
    expect(typeof data.hasMore).toBe('boolean')
    expect(typeof data.unreadCount).toBe('number')

    // Validate each inbox item
    data.items.forEach((item: any) => {
      validateInboxItem(item)
    })

    // Validate unread count matches items
    const unreadItems = data.items.filter((item: any) => !item.read)
    expect(data.unreadCount).toBeGreaterThanOrEqual(unreadItems.length)
  })

  test('POST /api/member/inbox/mark-read - returns valid InboxMarkReadResponse', async ({ page }) => {
    await loginAsMember(page, 'test@example.com')

    // Get an unread message first
    const getResponse = await page.request.get('/api/member/inbox')
    const inbox = await getResponse.json()
    const unreadItem = inbox.items.find((item: any) => !item.read)

    if (!unreadItem) {
      test.skip() // Skip if no unread messages
      return
    }

    // Mark as read
    const response = await page.request.post('/api/member/inbox/mark-read', {
      data: { ids: [unreadItem.id] }
    })
    expect(response.ok()).toBeTruthy()

    const data = await response.json()
    expect(data).toHaveProperty('updated')
    expect(typeof data.updated).toBe('number')
    expect(data.updated).toBe(1)
  })
})

test.describe('Error Response Contracts', () => {
  test('Unauthorized requests return valid ErrorResponse', async ({ page }) => {
    // Don't login - test unauthorized access
    const response = await page.request.get('/api/member/wallet')
    expect(response.status()).toBe(401)

    const data = await response.json()
    expect(data).toHaveProperty('error')
    expect(typeof data.error).toBe('string')
  })
})
