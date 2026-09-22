import { NextResponse } from 'next/server'
import { markAllNotificationsRead } from '@/lib/data/getMemberRedesign'

export async function POST() {
  try {
    const success = await markAllNotificationsRead()

    if (success) {
      return NextResponse.json({ success: true })
    } else {
      return NextResponse.json({ success: false, error: 'failed_to_mark_read' }, { status: 400 })
    }
  } catch (error) {
    console.error('[mark-all-notifications-read] Error:', error)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
