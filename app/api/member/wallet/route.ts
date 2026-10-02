import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWalletSummary } from '@/lib/wallet/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const summary = await getWalletSummary(user.id)
    if (!summary) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json(summary)
  } catch (error) {
    console.error('[wallet] summary endpoint error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
