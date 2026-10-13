import { createRouteHandlerClient } from '@/lib/supabase/route-handler'
import { NextResponse } from 'next/server'
import type { InboxMarkReadResponse, ErrorResponse } from '@/lib/member-contracts'

export async function POST(request: Request) {
  try {
    const supabase = await createRouteHandlerClient()

    // Check auth
    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession()

    if (authError || !session) {
      return NextResponse.json<ErrorResponse>(
        { error: 'unauthorized' },
        { status: 401 }
      )
    }

    const userId = session.user.id

    // Parse request body
    const body: unknown = await request.json()

    if (
      !body ||
      typeof body !== 'object' ||
      !('ids' in body) ||
      !Array.isArray(body.ids)
    ) {
      return NextResponse.json<ErrorResponse>(
        { error: 'Invalid request body' },
        { status: 400 }
      )
    }

    const { ids } = body as { ids: string[] }

    if (ids.length === 0) {
      return NextResponse.json<InboxMarkReadResponse>({ updated: 0 })
    }

    // Mark as read (only for the current user)
    const { error: updateError, count } = await supabase
      .from('admin_notifications')
      .update({ read: true }, { count: 'exact' })
      .eq('user_id', userId)
      .in('id', ids)

    if (updateError) {
      console.error('Mark read error:', updateError)
      return NextResponse.json<ErrorResponse>(
        { error: 'server_error' },
        { status: 500 }
      )
    }

    const response: InboxMarkReadResponse = {
      updated: count ?? 0,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Mark read route error:', error)
    return NextResponse.json<ErrorResponse>(
      { error: 'server_error' },
      { status: 500 }
    )
  }
}
