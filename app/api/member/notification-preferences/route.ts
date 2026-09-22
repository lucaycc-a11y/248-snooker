import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ════════════════════════════════════════════════════════════════════════════
// GET /api/member/notification-preferences
// Returns user's notification preferences
// ════════════════════════════════════════════════════════════════════════════

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    // Fetch preferences from user metadata or separate table
    // For now, return defaults (can be extended to persist in DB)
    const preferences = {
      email_booking_confirmed: true,
      email_booking_reminder: true,
      email_offers: true,
      email_promotions: true,
      push_booking_reminder: true,
      push_offers: true,
      push_system: true,
    }

    return NextResponse.json({ preferences })
  } catch (error) {
    console.error('[notification-preferences] Error:', error)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}

// ════════════════════════════════════════════════════════════════════════════
// POST /api/member/notification-preferences
// Saves user's notification preferences
// ════════════════════════════════════════════════════════════════════════════

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const { preferences } = await request.json()

    // TODO: Persist preferences to DB (user_preferences table or user metadata)
    // For now, just return success
    console.log('[notification-preferences] Saved for user:', user.id, preferences)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[notification-preferences] Error:', error)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
