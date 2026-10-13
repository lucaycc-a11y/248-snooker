import { createRouteHandlerClient } from '@/lib/supabase/route-handler'
import { NextResponse } from 'next/server'
import type { InboxResponse, ErrorResponse } from '@/lib/member-contracts'
import type { NotificationType } from '@/lib/ledger-types'

export async function GET(request: Request) {
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

    // Get user to verify they exist
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .single()

    if (userError || !user) {
      return NextResponse.json<ErrorResponse>(
        { error: 'unauthorized' },
        { status: 401 }
      )
    }

    // Parse query params
    const { searchParams } = new URL(request.url)
    const cursor = searchParams.get('cursor')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100)

    // Fetch notifications
    let query = supabase
      .from('admin_notifications')
      .select('id, type, title, message, read, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit + 1)

    if (cursor) {
      query = query.lt('created_at', cursor)
    }

    const { data: notifications, error: fetchError } = await query

    if (fetchError) {
      console.error('Inbox fetch error:', fetchError)
      return NextResponse.json<ErrorResponse>(
        { error: 'server_error' },
        { status: 500 }
      )
    }

    const hasMore = notifications.length > limit
    const items = notifications.slice(0, limit).map((n: {
      id: string
      type: string
      title: string
      message: string
      read: boolean
      created_at: string
    }) => ({
      id: n.id,
      type: n.type as NotificationType,
      title: n.title,
      message: n.message,
      read: n.read,
      createdAt: n.created_at,
    }))

    const nextCursor = hasMore ? items[items.length - 1]?.createdAt ?? null : null

    // Get unread count
    const { count: unreadCount, error: countError } = await supabase
      .from('admin_notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false)

    if (countError) {
      console.error('Unread count error:', countError)
    }

    const response: InboxResponse = {
      items,
      hasMore,
      nextCursor,
      unreadCount: unreadCount ?? 0,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Inbox route error:', error)
    return NextResponse.json<ErrorResponse>(
      { error: 'server_error' },
      { status: 500 }
    )
  }
}
