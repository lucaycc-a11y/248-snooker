// Dev2 Panel: Payment Log
// Returns recent payment attempts for debugging

import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { getServiceSupabase } from '@/lib/supabase/service'

export const runtime = 'edge'

export async function GET() {
  const admin = await getAdminData()
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const service = getServiceSupabase()

    // Query payment_attempts table
    const { data: payments, error } = await service
      .from('payment_attempts')
      .select('id, booking_id, amount, method, status, is_test, created_at, updated_at')
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) throw error

    return NextResponse.json({
      payments: (payments || []).map((p) => ({
        id: p.id,
        bookingId: p.booking_id,
        amount: p.amount,
        method: p.method,
        status: p.status,
        isTest: p.is_test,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
      })),
    })
  } catch (error) {
    console.error('[dev2/payment-log] error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
