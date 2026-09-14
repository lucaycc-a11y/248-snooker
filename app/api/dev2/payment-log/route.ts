import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function checkAdminAuth() {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) return false

  const { data: adminData } = await supabase
    .from('admin_users')
    .select('is_active')
    .eq('user_id', session.user.id)
    .single()

  return adminData?.is_active || false
}

export async function GET() {
  try {
    if (!(await checkAdminAuth())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createClient()

    const { data: payments } = await supabase
      .from('bookings')
      .select('id, total_price, payment_method, payment_status, is_test, created_at')
      .not('payment_status', 'is', null)
      .order('created_at', { ascending: false })
      .limit(50)

    return NextResponse.json({ payments: payments || [] })
  } catch (error) {
    console.error('Error fetching payment log:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
