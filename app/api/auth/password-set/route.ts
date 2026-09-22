import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { getServiceSupabase } from '@/lib/supabase/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Marks the authenticated user's password as set in user_password_status.
// Called after successfully setting a password via updateUser({ password }).
// This endpoint is idempotent and can be called multiple times safely.
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: () => {}, // Read-only in this handler
        },
      }
    )

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    // Update password status via service client (server-only table)
    const service = getServiceSupabase()
    const { error } = await service
      .from('user_password_status')
      .upsert(
        {
          user_id: user.id,
          password_set: true,
          password_set_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )

    if (error) {
      console.error('[password-set] Failed to update status:', error)
      return NextResponse.json({ error: 'internal_error' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[password-set] error:', error)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
