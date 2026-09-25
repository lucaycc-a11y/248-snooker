import { createClient } from '@/lib/supabase/server'

import { type MemberDashboardData } from './memberRedesignTypes'

// ════════════════════════════════════════════════════════════════════════════
// getMemberDashboardData — Fetch member profile for redesigned /member page
// Returns null if unauthenticated
// ════════════════════════════════════════════════════════════════════════════

export async function getMemberDashboardData(): Promise<MemberDashboardData | null> {
  const supabase = await createClient()

  // SECURITY: Use getUser() not getSession() for server-side auth decisions
  // getSession() reads cookies which can be forged; getUser() validates with auth server
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return null
  }

  // Fetch profile with points, tier, member_code
  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('id, display_name, email, phone, tier, points, member_code, gender, date_of_birth, birthday_set')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    throw new Error(`Profile fetch failed: ${profileError?.message ?? 'no profile'}`)
  }

  // Count unread notifications (inbox)
  // Graceful degradation: if the admin_notifications table doesn't exist yet,
  // default to 0 unread notifications rather than crashing the page
  let unreadCount = 0
  try {
    const { count, error: notifError } = await supabase
      .from('admin_notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('read', false)

    if (notifError) {
      console.warn('[getMemberRedesign] admin_notifications query failed:', notifError.message)
    } else {
      unreadCount = count ?? 0
    }
  } catch (err) {
    // Table doesn't exist or query failed — graceful degradation to 0 unread
    console.warn('[getMemberRedesign] admin_notifications query threw:', err)
  }

  return {
    profile: {
      id: profile.id,
      display_name: profile.display_name,
      email: profile.email,
      phone: profile.phone,
      tier: profile.tier ?? 'amateur',
      points: profile.points ?? 0,
      member_code: profile.member_code ?? '',
      unread_notifications: unreadCount ?? 0,
      gender: profile.gender,
      date_of_birth: profile.date_of_birth,
      birthday_set: profile.birthday_set ?? false,
    },
  }
}
