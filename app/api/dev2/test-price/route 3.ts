import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function checkAdminAuth() {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) return { authorized: false, userId: null }

  const { data: adminData } = await supabase
    .from('admin_users')
    .select('is_active')
    .eq('user_id', session.user.id)
    .single()

  return {
    authorized: adminData?.is_active || false,
    userId: session.user.id,
  }
}

export async function POST(request: NextRequest) {
  try {
    const { authorized, userId } = await checkAdminAuth()
    if (!authorized || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { mode, amount, label } = await request.json()

    if (!mode || amount === undefined) {
      return NextResponse.json(
        { error: 'Mode and amount required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Deactivate old active price
    await supabase
      .from('uat_test_pricing')
      .update({ is_active: false })
      .eq('is_active', true)

    // Insert new active price
    await supabase.from('uat_test_pricing').insert({
      mode,
      amount,
      label,
      is_active: true,
      created_at: new Date().toISOString(),
    })

    // Audit log
    await supabase.from('audit_log').insert({
      user_id: userId,
      action: 'set_test_price',
      details: { mode, amount, label },
      created_at: new Date().toISOString(),
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error setting test price:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
