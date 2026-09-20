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

    // Get recent audit log entries related to auth
    const { data: authEvents } = await supabase
      .from('audit_log')
      .select('*')
      .or('action.like.%login%,action.like.%otp%,action.like.%auth%')
      .order('created_at', { ascending: false })
      .limit(50)

    return NextResponse.json({ authEvents: authEvents || [] })
  } catch (error) {
    console.error('Error fetching auth log:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
