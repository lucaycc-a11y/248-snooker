import type { SupabaseClient } from '@supabase/supabase-js'
import { getServiceSupabase } from '@/lib/supabase/service'

const db = () => getServiceSupabase() as unknown as SupabaseClient

/** true when this user id belongs to an admin (service-role lookup). */
export async function isAdminUserId(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false
  try {
    const { data } = await db().from('admin_users').select('user_id').eq('user_id', userId).maybeSingle()
    return Boolean(data)
  } catch {
    return false
  }
}
