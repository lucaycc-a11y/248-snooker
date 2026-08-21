import { getServiceSupabase } from '@/lib/supabase/service'
import { normalizePhone } from '@/lib/phone'

export type PhoneBindingResult =
  | { ok: true }
  | { ok: false; error: 'phone_invalid' | 'phone_taken' | 'db_error' }

// Returns the auth user id whose public.users row has this phone, or null.
// Queries the table directly — avoids admin.listUsers pagination and rate limits.
export async function findUserByPhone(e164Phone: string): Promise<string | null> {
  const sb = getServiceSupabase()
  const { data, error } = await sb
    .from('users')
    .select('id')
    .eq('phone', e164Phone)
    .maybeSingle()
  if (error || !data) return null
  return data.id as string
}

export async function bindVerifiedPhone(
  userId: string,
  rawPhone: string,
): Promise<PhoneBindingResult> {
  const e164 = normalizePhone(rawPhone)
  if (!e164) return { ok: false, error: 'phone_invalid' }

  const sb = getServiceSupabase()

  // Check uniqueness before writing — cleaner error than a constraint violation.
  const { data: existing, error: lookupErr } = await sb
    .from('users')
    .select('id')
    .eq('phone', e164)
    .neq('id', userId)
    .maybeSingle()

  if (lookupErr) return { ok: false, error: 'db_error' }
  if (existing) return { ok: false, error: 'phone_taken' }

  const { error: updateErr } = await sb
    .from('users')
    .update({ phone: e164, phone_verified_at: new Date().toISOString() })
    .eq('id', userId)

  if (updateErr) return { ok: false, error: 'db_error' }
  return { ok: true }
}
