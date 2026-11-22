import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { looseRpc } from '@/lib/member/pilot-rpc'

export const dynamic = 'force-dynamic'

type Slot = { date: string; startHour: number; tableNumber: 1 | 2 }

function parseSlot(value: unknown): { status: string; slot: Slot | null } {
  if (typeof value !== 'object' || value === null) return { status: 'ERROR', slot: null }
  const v = value as Record<string, unknown>
  const status = typeof v.status === 'string' ? v.status : 'ERROR'
  if (
    status === 'OK' &&
    typeof v.date === 'string' &&
    typeof v.start_hour === 'number' &&
    (v.table_number === 1 || v.table_number === 2)
  ) {
    return { status, slot: { date: v.date, startHour: v.start_hour, tableNumber: v.table_number } }
  }
  return { status, slot: null }
}

// GET /api/member/pilot/extend?b=<booking id>
// The hour right after a running booking. The page then hands it to the normal booking
// and payment flow (/book), so extending is paid exactly like any other booking.
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get('b') ?? ''
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: 'bad_booking' }, { status: 400 })
  }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await looseRpc(supabase)('pilot_extension_slot', { p_booking_id: id })
  if (error) {
    console.error('[member/pilot/extend] rpc failed', error.message)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
  const { status, slot } = parseSlot(data)
  if (!slot) {
    // NOT_FOUND, ENDED, NOT_ON_HOUR, TAKEN
    return NextResponse.json({ error: status.toLowerCase() }, { status: status === 'TAKEN' ? 409 : 404 })
  }
  return NextResponse.json(slot)
}
