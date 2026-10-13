/**
 * Member Contracts - TypeScript types for all member API responses (Section 4)
 *
 * Sub-agents import these; they do not redefine them.
 * All shapes are fixed and validated by the backend routes.
 */

import type { PointsLedgerType, CreditsLedgerType, NotificationType } from './ledger-types'

// ============================================================================
// 4.1 Wallet API
// ============================================================================

export type WalletBalance = {
  balance: number // users.credits (HK$)
  held: number // sum of credit_holds where status='held'
  available: number // balance - held
  memberCode: string // users.member_code
}

export type WalletLedgerItem = {
  id: string
  type: CreditsLedgerType
  amount: number // signed: +10, -108
  balanceAfter: number
  createdAt: string // ISO timestamp
  note: string
  pointsConverted: number | null // parsed N for 'convert', else null
  booking: {
    id: string
    reference: string // booking_reference
    humanCode: string // human_code
    tableNumber: number
    date: string // YYYY-MM-DD
    startTime: string // HH:MM
    endTime: string // HH:MM
  } | null
}

export type WalletLedgerResponse = {
  items: WalletLedgerItem[]
  hasMore: boolean
  nextCursor: string | null
}

export type OfferAvailable = {
  code: string
  name: string
  discountType: string
  discountValue: number
  minCartAmount: number | null
  maxDiscount: number | null
  validUntil: string | null // ISO timestamp
}

export type OfferUsed = {
  code: string
  name: string
  discountAmount: number
  redeemedAt: string // ISO timestamp
}

export type WalletOffersResponse = {
  available: OfferAvailable[]
  used: OfferUsed[]
}

export type WalletApiResponse = WalletBalance & {
  currency: 'HKD'
  ledger: WalletLedgerResponse
}

// ============================================================================
// 4.2 Points API
// ============================================================================

export type PointsSummary = {
  lifetime: number // users.points
  redeemable: number // users.points - users.points_converted
  convertedPoints: number // sum of N parsed from credits_ledger convert notes
  depositedToWallet: number // sum of credits_ledger.amount where type in ('convert','signup')
  tier: string // users.tier
  blockSize: number // config.points_system.convert_points_block
  creditsPerBlock: number // config.points_system.convert_credits_per_block
}

export type PointsTransactionItem = {
  id: string
  source: 'points' | 'credits'
  type: PointsLedgerType | CreditsLedgerType
  points: number // signed, can be negative for convert/reversal/redeem
  depositedHkd: number | null // for credits convert rows
  paidHkd: number | null // bookings.total_price for booking rows
  createdAt: string // ISO timestamp
  note: string
  bookingReference: string | null
}

export type PointsTransactionsResponse = {
  items: PointsTransactionItem[]
  hasMore: boolean
  nextCursor: string | null
}

// ============================================================================
// 4.3 Inbox API
// ============================================================================

export type InboxItem = {
  id: string
  type: NotificationType
  title: string
  message: string
  read: boolean
  createdAt: string // ISO timestamp
}

export type InboxResponse = {
  items: InboxItem[]
  hasMore: boolean
  nextCursor: string | null
  unreadCount: number
}

export type InboxMarkReadResponse = {
  updated: number
}

export type InboxUnreadCountResponse = {
  count: number
}

// ============================================================================
// Common Error Response
// ============================================================================

export type ErrorResponse = {
  error: string // 'unauthorized' | 'server_error' | 'too_many_requests' | custom message
}
