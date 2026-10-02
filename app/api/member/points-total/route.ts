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

    // Get points total from user metadata or dedicated points table
    const { data: pointsData, error } = await supabase
      .from('user_points')
      .select('lifetime_points')
      .eq('user_id', session.user.id)
      .single()

    if (error) {
      // If no points record exists, return 0
      if (error.code === 'PGRST116') {
        return NextResponse.json({ points: 0 })
      }
      throw error
    }

    return NextResponse.json({ points: pointsData?.lifetime_points ?? 0 })
  } catch (error) {
    console.error('Error fetching points total:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
