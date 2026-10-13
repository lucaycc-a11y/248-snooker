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

    // 2. Fetch user profile with points_converted and tier
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('points, points_converted, tier')
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
    const pointsConverted = user.points_converted ?? 0

    // 3. Fetch all convert/signup entries from credits_ledger
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

    // Parse convert notes to extract converted points (for display)
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

    // 4. Calculate redeemable using users.points_converted
    const redeemable = lifetime - pointsConverted

    // 5. Fetch config points_system
    const { data: configRow, error: configError } = await supabase
      .from('config')
      .select('value')
      .eq('key', 'points_system')
      .single()

    if (configError) {
      console.error('Failed to fetch points_system config:', configError)
      return NextResponse.json<ErrorResponse>(
        { error: 'server_error' },
        { status: 500 }
      )
    }

    // Parse points_system config JSON
    const pointsSystem = configRow?.value as any
    if (!pointsSystem || typeof pointsSystem !== 'object') {
      console.error('points_system config is missing or invalid')
      return NextResponse.json<ErrorResponse>(
        { error: 'server_error' },
        { status: 500 }
      )
    }

    const blockSize = pointsSystem.convert_points_block
    const creditsPerBlock = pointsSystem.convert_credits_per_block

    if (typeof blockSize !== 'number' || typeof creditsPerBlock !== 'number') {
      console.error('points_system config missing convert_points_block or convert_credits_per_block')
      return NextResponse.json<ErrorResponse>(
        { error: 'server_error' },
        { status: 500 }
      )
    }

    const tier = user.tier ?? 'amateur'

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
