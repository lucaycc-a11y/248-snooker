import { getServiceSupabase } from '@/lib/supabase/service'
import { normalizePhone } from '@/lib/phone'

export type PhoneBindingResult =
  | { ok: true }
  | { ok: false; error: 'phone_invalid' | 'phone_taken' | 'db_error' }

// Returns the auth user id whose auth_identities row has this verified phone,
// or null. Falls back to public.users.phone for accounts not yet migrated.
export async function findUserByPhone(e164Phone: string): Promise<string | null> {
  const sb = getServiceSupabase()

  // Primary: check auth_identities (canonical identity ledger)
  const { data: identity, error: idErr } = await sb
    .from('auth_identities')
    .select('user_id')
    .eq('provider', 'phone')
    .eq('identifier', e164Phone)
    .eq('verified', true)
    .maybeSingle<{ user_id: string }>()

  if (!idErr && identity) return identity.user_id

  // Fallback: public.users.phone for accounts not yet migrated
  const { data: legacy, error: legErr } = await sb
    .from('users')
    .select('id')
    .eq('phone', e164Phone)
    .maybeSingle<{ id: string }>()

  if (legErr || !legacy) return null
  return legacy.id as string
}

export async function bindVerifiedPhone(
  userId: string,
  rawPhone: string,
): Promise<PhoneBindingResult> {
  const e164 = normalizePhone(rawPhone)
  if (!e164) return { ok: false, error: 'phone_invalid' }

  const sb = getServiceSupabase()

  // Check uniqueness in auth_identities before writing — cleaner error than a
  // constraint violation. Only verified identities block registration.
  const { data: existing, error: lookupErr } = await sb
    .from('auth_identities')
    .select('user_id')
    .eq('provider', 'phone')
    .eq('identifier', e164)
    .eq('verified', true)
    .neq('user_id', userId)
    .maybeSingle<{ user_id: string }>()

  if (lookupErr) return { ok: false, error: 'db_error' }
  if (existing) return { ok: false, error: 'phone_taken' }

  // Upsert into auth_identities (mark as verified)
  const { error: upsertErr } = await sb
    .from('auth_identities')
    .upsert(
      {
        user_id: userId,
        provider: 'phone',
        identifier: e164,
        verified: true,
        verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,provider,identifier' },
    )

  if (upsertErr) return { ok: false, error: 'db_error' }
  return { ok: true }
}
