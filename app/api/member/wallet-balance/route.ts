import { createRouteHandlerClient } from '@/lib/supabase/route-handler'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createRouteHandlerClient()

    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get wallet balance from user metadata or dedicated wallet table
    const { data: walletData, error } = await supabase
      .from('wallet')
      .select('balance')
      .eq('user_id', session.user.id)
      .single()

    if (error) {
      // If no wallet record exists, return 0
      if (error.code === 'PGRST116') {
        return NextResponse.json({ credits: 0 })
      }
      throw error
    }

    return NextResponse.json({ credits: walletData?.balance ?? 0 })
  } catch (error) {
    console.error('Error fetching wallet balance:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
