/**
 * Deleted user identity checks
 * Prevents re-registration during 6-month retention period
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export type DeletedUserCheckResult =
  | { allowed: true }
  | { allowed: false; reason: 'email_deleted' | 'phone_deleted' | 'apple_id_deleted' }

/**
 * Check if email is in deleted_users retention period
 */
export async function checkDeletedEmail(
  supabase: SupabaseClient,
  email: string
): Promise<boolean> {
  const { data } = await supabase.rpc('is_identity_deleted', {
    p_provider: 'email',
    p_identifier: email,
  })
  return data === true
}

/**
 * Check if phone is in deleted_users retention period
 */
export async function checkDeletedPhone(
  supabase: SupabaseClient,
  phone: string
): Promise<boolean> {
  const { data } = await supabase.rpc('is_identity_deleted', {
    p_provider: 'phone',
    p_identifier: phone,
  })
  return data === true
}

/**
 * Check if Apple ID is in deleted_users retention period
 */
export async function checkDeletedAppleId(
  supabase: SupabaseClient,
  appleId: string
): Promise<boolean> {
  const { data } = await supabase.rpc('is_identity_deleted', {
    p_provider: 'apple',
    p_identifier: appleId,
  })
  return data === true
}

/**
 * Comprehensive check for registration - validates email and phone
 * Returns allowed: false if either identity is in retention period
 */
export async function checkRegistrationAllowed(
  supabase: SupabaseClient,
  email: string,
  phone: string
): Promise<DeletedUserCheckResult> {
  const [emailDeleted, phoneDeleted] = await Promise.all([
    checkDeletedEmail(supabase, email),
    checkDeletedPhone(supabase, phone),
  ])

  if (emailDeleted) {
    return { allowed: false, reason: 'email_deleted' }
  }

  if (phoneDeleted) {
    return { allowed: false, reason: 'phone_deleted' }
  }

  return { allowed: true }
}
