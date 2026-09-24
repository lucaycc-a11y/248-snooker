import { NextResponse } from 'next/server'
import { setBirthMonth } from '@/lib/data/getMemberRedesign'

export async function POST(req: Request) {
  try {
    const { month } = await req.json()

    if (!month || month < 1 || month > 12) {
      return NextResponse.json({ error: 'invalid_month' }, { status: 400 })
    }

    const result = await setBirthMonth(month)

    if (result.success) {
      return NextResponse.json({ success: true })
    } else {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 })
    }
  } catch (error) {
    console.error('[set-birth-month] Error:', error)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
