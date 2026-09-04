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
  console.log('[bindVerifiedPhone] start', {
    userId,
    phoneTail: rawPhone.slice(-3),
    ts: Date.now(),
  })

  const e164 = normalizePhone(rawPhone)
  console.log('[bindVerifiedPhone] normalized', { e164: e164 || null, ts: Date.now() })
  if (!e164) {
    console.warn('[bindVerifiedPhone] normalize failed', { ts: Date.now() })
    return { ok: false, error: 'phone_invalid' }
  }

  const sb = getServiceSupabase()
  console.log('[bindVerifiedPhone] service client created', { ts: Date.now() })

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

  console.log('[bindVerifiedPhone] lookup existing (other users)', {
    hasExisting: !!existing,
    existingUserId: existing?.user_id ?? null,
    error: lookupErr?.message ?? null,
    errorCode: lookupErr?.code ?? null,
    errorDetails: lookupErr?.details ?? null,
    errorHint: lookupErr?.hint ?? null,
    ts: Date.now(),
  })

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

  console.log('[bindVerifiedPhone] lookup own row', {
    hasOwn: !!own,
    alreadyVerified: own?.verified ?? null,
    error: ownErr?.message ?? null,
    errorCode: ownErr?.code ?? null,
    errorDetails: ownErr?.details ?? null,
    errorHint: ownErr?.hint ?? null,
    ts: Date.now(),
  })

  if (!ownErr && own?.verified) {
    // Same user re-verifying their own already-bound phone: treat as success.
    console.log('[bindVerifiedPhone] already verified for this user', { ts: Date.now() })
    return { ok: true, alreadyVerified: true }
  }

  if (!ownErr && own) {
    // User has an unverified row for this phone — flip it to verified.
    console.log('[bindVerifiedPhone] updating own unverified row', { rowId: own.id, ts: Date.now() })
    const { data: updateData, error: updateErr } = await sb
      .from('auth_identities')
      .update({
        verified: true,
        verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', own.id)
      .select()

    console.log('[bindVerifiedPhone] update result', {
      success: !updateErr,
      data: updateData ?? null,
      error: updateErr?.message ?? null,
      errorCode: updateErr?.code ?? null,
      errorDetails: updateErr?.details ?? null,
      ts: Date.now(),
    })

    if (updateErr) {
      console.error('[bindVerifiedPhone] update failed', { fullError: updateErr, ts: Date.now() })
      return { ok: false, error: 'db_error' }
    }
    console.log('[bindVerifiedPhone] success via update', { ts: Date.now() })
    return { ok: true }
  }

  // No existing row for this user + phone — insert fresh.
  console.log('[bindVerifiedPhone] inserting new row', { userId, e164, ts: Date.now() })
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

  console.log('[bindVerifiedPhone] insert result', {
    success: !insertErr,
    data: insertData ?? null,
    error: insertErr?.message ?? null,
    errorCode: insertErr?.code ?? null,
    errorDetails: insertErr?.details ?? null,
    errorHint: insertErr?.hint ?? null,
    ts: Date.now(),
  })

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
  console.log('[bindVerifiedPhone] success via insert', { ts: Date.now() })
  return { ok: true }
}
