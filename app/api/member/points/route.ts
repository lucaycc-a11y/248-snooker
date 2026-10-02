import { createRouteHandlerClient } from '@/lib/supabase/route-handler'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// GET /api/member/points
// Returns points summary: lifetime, redeemable, converted, deposited to wallet, tier, block size, credits per block
export async function GET(request: NextRequest) {
  try {
    const supabase = await createRouteHandlerClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch user's tier and points info
    const { data: userData, error: userDataError } = await supabase
      .from('users')
      .select('tier, points_lifetime, points_redeemable, points_converted, points_to_wallet')
      .eq('id', user.id)
      .single()

    if (userDataError) {
      console.error('[points] user fetch error:', userDataError)
      return NextResponse.json({ error: 'Failed to fetch user data' }, { status: 500 })
    }

    // Fetch tier configuration for block size and credits per block
    const { data: tierConfig, error: tierError } = await supabase
      .from('config')
      .select('value')
      .eq('key', `tier_config_${userData?.tier || 'standard'}`)
      .single()

    if (tierError && tierError.code !== 'PGRST116') {
      console.error('[points] tier config fetch error:', tierError)
      return NextResponse.json({ error: 'Failed to fetch tier config' }, { status: 500 })
    }

    let blockSize = 100
    let creditsPerBlock = 10
    if (tierConfig?.value) {
      const config = typeof tierConfig.value === 'object' ? tierConfig.value : null
      if (config) {
        blockSize = (config as Record<string, unknown>).block_size as number ?? 100
        creditsPerBlock = (config as Record<string, unknown>).credits_per_block as number ?? 10
      }
    }

    return NextResponse.json({
      lifetime: userData?.points_lifetime ?? 0,
      redeemable: userData?.points_redeemable ?? 0,
      converted: userData?.points_converted ?? 0,
      depositedToWallet: userData?.points_to_wallet ?? 0,
      tier: userData?.tier ?? 'standard',
      blockSize,
      creditsPerBlock,
    })
  } catch (err) {
    console.error('[points] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
