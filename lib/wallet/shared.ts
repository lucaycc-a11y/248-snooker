import { createClient } from '@/lib/supabase/server'
import { resolveTier, DEFAULT_TIERS, type Tier } from '@/lib/data/pricing'
import { generateMemberQR } from '@/lib/qrcode'

// Shared wallet-pass domain logic — used by BOTH the Apple (passkit-generator)
// and Google Wallet (Loyalty class) routes so tier names / latest-booking /
// QR content never drift between the two platforms.

/** ISO 639-1 codes used by Apple Wallet `.lproj` folders. */
export type WalletLocale = 'zh-Hant' | 'zh-Hans' | 'en'

/** Tier display names in the three supported languages.
 * Re-exported from the unified mapping (lib/member/tierDisplay) so wallet
 * passes and site UI never drift; kept here for backward compatibility. */
export { TIER_DISPLAY } from '@/lib/member/tierDisplay'

/** Static labels shared across both platforms. */
export const WALLET_LABELS = {
  member: { zhHK: '會員', zhCN: '会员', en: 'Member' },
  tier: { zhHK: '等級', zhCN: '等级', en: 'Tier' },
  points: { zhHK: '積分', zhCN: '积分', en: 'Points' },
  latestBooking: { zhHK: '最近訂枱', zhCN: '最近订台', en: 'Latest Booking' },
  noBooking: { zhHK: '暫無預約', zhCN: '暂无预约', en: 'No Booking Yet' },
  bookingTable: { zhHK: '枱號', zhCN: '台号', en: 'Table' },
} as const

export type WalletMember = {
  memberCode: string
  displayName: string
  tierId: Tier['id']
  points: number
  /** Latest confirmed booking summary, or null when the member has no booking. */
  latestBooking: { date: string; startTime: string; tableId: string | number } | null
  /** PNG buffer of the member QR (encodes memberCode — matches /api/member/qr). */
  qrPng: Buffer
}

/**
 * Fetch the wallet-pass payload for the currently authenticated user.
 * Returns null when unauthenticated. Every related query is defensive —
 * a missing column/table degrades to defaults rather than throwing, so a
 * broken wallet card never takes down the member dashboard.
 */
export async function getWalletMember(): Promise<WalletMember | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  // ── Profile (points / member_code). ──
  let points = 0
  let memberCode = ''
  let displayName: string | null = null
  try {
    const { data } = await supabase
      .from('users')
      .select('points, member_code, display_name')
      .eq('id', user.id)
      .maybeSingle()
    if (data) {
      points = typeof data.points === 'number' ? data.points : 0
      memberCode = (data.member_code as string) ?? ''
      displayName = (data.display_name as string) ?? null
    }
  } catch {
    /* fall through to defaults */
  }

  const tierId = resolveTier(points, DEFAULT_TIERS).current.id

  // ── Latest confirmed booking (defensive — empty when table missing). ──
  let latestBooking: WalletMember['latestBooking'] = null
  try {
    const { data } = await supabase
      .from('bookings')
      .select('date, start_time, table_number, status')
      .eq('user_id', user.id)
      .eq('status', 'confirmed')
      .order('start_time', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (data) {
      latestBooking = {
        date: (data.date as string) ?? '',
        startTime: String(data.start_time ?? '').slice(0, 5),
        tableId: (data.table_number as string | number) ?? '',
      }
    }
  } catch {
    /* bookings table may not exist */
  }

  // ── QR PNG (same encode as the in-app member QR: plain member_code). ──
  const qr = await generateMemberQR(memberCode, {
    format: 'buffer',
    width: 400,
    color: { dark: '#000000', light: '#ffffff' },
  })
  const qrPng = Buffer.isBuffer(qr) ? qr : Buffer.from(qr.replace(/^data:image\/png;base64,/, ''), 'base64')

  return {
    memberCode,
    displayName: displayName ?? user.email?.split('@')[0] ?? 'Member',
    tierId,
    points,
    latestBooking,
    qrPng,
  }
}