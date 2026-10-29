/**
 * Per-admin test mode. Server-side only — the flag lives on admin_users and is
 * read with the service role, so a client can never assert it for itself.
 * Only an ACTIVE admin row with test_mode = true counts.
 */
import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'

export async function isAdminTestModeOn(userId: string): Promise<boolean> {
  try {
    const { data } = await getLegacyServiceSupabase()
      .from('admin_users')
      .select('test_mode')
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle()
    return (data as { test_mode?: unknown } | null)?.test_mode === true
  } catch {
    // Fail safe: on any lookup problem the checkout is NOT treated as a test.
    return false
  }
}
