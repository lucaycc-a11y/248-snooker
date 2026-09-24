import { getServiceSupabase } from '@/lib/supabase/service'
import { normalizePhone } from '@/lib/phone'

export type PhoneBindingResult =
  | { ok: true; alreadyVerified?: boolean }
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
  if (!e164) {
    console.warn('[bindVerifiedPhone] normalize failed', { ts: Date.now() })
    return { ok: false, error: 'phone_invalid' }
  }

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

  if (lookupErr) {
    console.error('[bindVerifiedPhone] lookup DB error, returning db_error', {
      fullError: lookupErr,
      ts: Date.now(),
    })
    return { ok: false, error: 'db_error' }
  }
  if (existing) return { ok: false, error: 'phone_taken' }

  // If this user already has a row for this phone, branch: already-verified
  // is a no-op success; unverified gets UPDATE'd; no row means fresh INSERT.
  // This avoids upsert / ON CONFLICT entirely — the partial unique index
  // auth_identities_verified_unique (WHERE verified=true) is incompatible with
  // supabase-js .upsert(), which cannot supply the required WHERE predicate
  // and therefore always triggers 42P10.
  const { data: own, error: ownErr } = await sb
    .from('auth_identities')
    .select('id, verified')
    .eq('user_id', userId)
    .eq('provider', 'phone')
    .eq('identifier', e164)
    .maybeSingle<{ id: string; verified: boolean }>()

  if (!ownErr && own?.verified) {
    // Same user re-verifying their own already-bound phone: treat as success.
    return { ok: true, alreadyVerified: true }
  }

  if (!ownErr && own) {
    // User has an unverified row for this phone — flip it to verified.
    const { data: updateData, error: updateErr } = await sb
      .from('auth_identities')
      .update({
        verified: true,
        verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', own.id)
      .select()

    if (updateErr) {
      console.error('[bindVerifiedPhone] update failed', { fullError: updateErr, ts: Date.now() })
      return { ok: false, error: 'db_error' }
    }
    return { ok: true }
  }

  // No existing row for this user + phone — insert fresh.
  const { data: insertData, error: insertErr } = await sb
    .from('auth_identities')
    .insert({
      user_id: userId,
      provider: 'phone',
      identifier: e164,
      verified: true,
      verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()

  if (insertErr) {
    // 23505 = unique_violation — a concurrent request won the race.
    // Treat as phone_taken so the user sees a clear message, not a 500.
    if (insertErr.code === '23505') {
      console.warn('[bindVerifiedPhone] insert race-condition unique violation', { ts: Date.now() })
      return { ok: false, error: 'phone_taken' }
    }
    console.error('[bindVerifiedPhone] insert failed', { fullError: insertErr, ts: Date.now() })
    return { ok: false, error: 'db_error' }
  }
  return { ok: true }
}
