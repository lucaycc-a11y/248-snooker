import { createClient } from '@/lib/supabase/server'

import { type MemberDashboardData } from './memberRedesignTypes'

// ════════════════════════════════════════════════════════════════════════════
// getMemberDashboardData — Fetch member profile for redesigned /member page
// Returns null if unauthenticated
// ════════════════════════════════════════════════════════════════════════════

export async function getMemberDashboardData(): Promise<MemberDashboardData | null> {
  const supabase = await createClient()

  // Get current user
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.user) {
    return null
  }

  // Fetch profile with points, tier, member_code
  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('id, display_name, email, phone, tier, points, member_code, gender, birthday, birthday_set, birth_month')
    .eq('id', session.user.id)
    .single()

  if (profileError || !profile) {
    throw new Error(`Profile fetch failed: ${profileError?.message ?? 'no profile'}`)
  }

  // Count unread notifications (inbox)
  const { count: unreadCount } = await supabase
    .from('admin_notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', session.user.id)
    .eq('read', false)

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
      birthday: profile.birthday,
      birthday_set: profile.birthday_set ?? false,
      birth_month: profile.birth_month ?? null,
    },
  }
}
