import { createClient } from '@/lib/supabase/server'

import { NextResponse } from 'next/server'

// ════════════════════════════════════════════════════════════════════════════
// GET /api/member/check-admin — Check if current user is admin
// Used by Wallet feature to show real vs locked preview
// ════════════════════════════════════════════════════════════════════════════

export async function GET() {
  const supabase = await createClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.user) {
    return NextResponse.json({ isAdmin: false })
  }

  // Check admin_users table
  const { data: adminUser } = await supabase
    .from('admin_users')
    .select('is_active')
    .eq('user_id', session.user.id)
    .eq('is_active', true)
    .single()

  return NextResponse.json({ isAdmin: !!adminUser })
}
