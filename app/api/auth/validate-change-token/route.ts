import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { validateChangeToken } from '@/lib/auth/change-token'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RequestBody = { token: string; purpose: 'password' | 'phone' }

// Validates a change request token. Returns ok: true if valid, or error code.
// Used by change-password and change-phone pages on mount.
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: () => {}, // Read-only
        },
      }
    )

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const body = (await request.json().catch(() => null)) as RequestBody | null
    const { token, purpose } = body || {}

    if (!token || !purpose || (purpose !== 'password' && purpose !== 'phone')) {
      return NextResponse.json({ error: 'invalid_input' }, { status: 422 })
    }

    const result = await validateChangeToken(token, purpose, user.id)

    if (result.ok) {
      return NextResponse.json({ ok: true, requestId: result.requestId })
    }

    return NextResponse.json({ ok: false, error: result.error }, { status: 400 })
  } catch (error) {
    console.error('[validate-change-token] error:', error)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
