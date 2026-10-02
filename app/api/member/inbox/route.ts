import { createRouteHandlerClient } from '@/lib/supabase/route-handler'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const supabase = await createRouteHandlerClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.user.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const url = new URL(req.url)
    const page = parseInt(url.searchParams.get('page') || '1', 10)
    const pageSize = 20
    const offset = (page - 1) * pageSize

    const { data, error } = await supabase
      .from('admin_notifications')
      .select('id, title, message, type, read, created_at')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1)

    if (error) throw error

    return NextResponse.json(
      {
        notifications: (data || []).map((n: any) => ({
          id: n.id,
          title: n.title,
          message: n.message,
          type: n.type,
          read: n.read,
          createdAt: n.created_at,
        })),
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('[GET /api/member/inbox]', error)
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 }
    )
  }
}

export async function PUT(req: NextRequest) {
  const supabase = await createRouteHandlerClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.user.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await req.json()

    if (!id) {
      return NextResponse.json(
        { error: 'Missing notification id' },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from('admin_notifications')
      .update({ read: true })
      .eq('id', id)
      .eq('user_id', session.user.id)

    if (error) throw error

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('[PUT /api/member/inbox]', error)
    return NextResponse.json(
      { error: 'Failed to mark notification as read' },
      { status: 500 }
    )
  }
}

