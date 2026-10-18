import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { getMonthDensity, getDayTimeline } from '@/lib/data/getAdminCalendar'

// GET ?view=month&year=&month=  or  ?view=day&date=YYYY-MM-DD

export async function GET(req: Request) {
  const admin = await getAdminData()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const view = url.searchParams.get('view')

  if (view === 'day') {
    const date = url.searchParams.get('date')
    if (!date) return NextResponse.json({ error: 'Missing date' }, { status: 400 })
    try {
      const bookings = await getDayTimeline(date)
      return NextResponse.json({ bookings })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal error'
      return NextResponse.json({ error: message, bookings: [] }, { status: 500 })
    }
  }

  const now = new Date()
  const year = parseInt(url.searchParams.get('year') ?? String(now.getFullYear()), 10)
  const month = parseInt(url.searchParams.get('month') ?? String(now.getMonth() + 1), 10)
  const days = await getMonthDensity(year, month)
  return NextResponse.json({ days })
}
