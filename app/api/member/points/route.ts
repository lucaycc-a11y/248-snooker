import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@/lib/supabase/route-handler'
import type {
  PointsSummary,
  ErrorResponse,
} from '@/lib/member-contracts'

/**
 * GET /api/member/points
 *
 * Returns the summary for the points page:
 * - lifetime: users.points (total earned)
 * - redeemable: users.points - sum of N from credits_ledger convert notes
 * - convertedPoints: sum of N from credits_ledger convert notes
 * - depositedToWallet: sum of credits_ledger.amount for convert/signup
 * - tier, blockSize, creditsPerBlock from config table
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createRouteHandlerClient()

    // 1. Check auth
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json<ErrorResponse>(
        { error: 'unauthorized' },
        { status: 401 }
      )
    }

    const userId = session.user.id

    // 2. Fetch user profile
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('points')
      .eq('id', userId)
      .single()

    if (userError || !user) {
      console.error('Failed to fetch user:', userError)
      return NextResponse.json<ErrorResponse>(
        { error: 'user_not_found' },
        { status: 404 }
      )
    }

    const lifetime = user.points ?? 0

    // 3. Fetch all convert entries from credits_ledger to calculate convertedPoints
    const { data: convertRows, error: convertError } = await supabase
      .from('credits_ledger')
      .select('note, amount')
      .eq('user_id', userId)
      .in('type', ['convert', 'signup'])

    if (convertError) {
      console.error('Failed to fetch credits_ledger:', convertError)
      return NextResponse.json<ErrorResponse>(
        { error: 'server_error' },
        { status: 500 }
      )
    }

    // Parse convert notes to extract converted points
    let convertedPoints = 0
    let depositedToWallet = 0

    for (const row of convertRows || []) {
      // Add amount to depositedToWallet
      depositedToWallet += row.amount

      // Parse note for converted points (format: "Convert 100 pts → HK$10")
      const note = row.note || ''
      const match = note.match(/Convert (\d+) pts/)
      if (match) {
        const points = parseInt(match[1], 10)
        if (!isNaN(points)) {
          convertedPoints += points
        }
      }
    }

    // 4. Calculate redeemable
    const redeemable = lifetime - convertedPoints

    // 5. Fetch config values
    const { data: configRows, error: configError } = await supabase
      .from('config')
      .select('key, value')
      .in('key', ['points_tier', 'points_block_size', 'points_credits_per_block'])

    if (configError) {
      console.error('Failed to fetch config:', configError)
      return NextResponse.json<ErrorResponse>(
        { error: 'server_error' },
        { status: 500 }
      )
    }

    // Parse config
    const configMap = new Map<string, string>()
    for (const row of configRows || []) {
      const value = row.value
      if (typeof value === 'string') {
        configMap.set(row.key, value)
      }
    }

    const tier = configMap.get('points_tier') || 'standard'
    const blockSize = parseInt(configMap.get('points_block_size') || '100', 10)
    const creditsPerBlock = parseInt(configMap.get('points_credits_per_block') || '10', 10)

    // 6. Return summary
    const summary: PointsSummary = {
      lifetime,
      redeemable,
      convertedPoints,
      depositedToWallet,
      tier,
      blockSize,
      creditsPerBlock,
    }

    return NextResponse.json(summary)
  } catch (err) {
    console.error('GET /api/member/points error:', err)
    return NextResponse.json<ErrorResponse>(
      { error: 'server_error' },
      { status: 500 }
    )
  }
}
