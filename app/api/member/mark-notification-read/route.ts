import { NextResponse } from 'next/server'
import { markNotificationRead } from '@/lib/data/getMemberRedesign'

export async function POST(req: Request) {
  try {
    const { notificationId } = await req.json()

    if (!notificationId) {
      return NextResponse.json({ error: 'notification_id_required' }, { status: 400 })
    }

    const success = await markNotificationRead(notificationId)

    if (success) {
      return NextResponse.json({ success: true })
    } else {
      return NextResponse.json({ success: false, error: 'failed_to_mark_read' }, { status: 400 })
    }
  } catch (error) {
    console.error('[mark-notification-read] Error:', error)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
