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

  // Same user re-verifying their own already-bound phone: the upsert below is
  // idempotent for this case, but detect it explicitly so the route can return
  // 200 instead of surfacing a constraint error as a transient 500.
  const { data: own, error: ownErr } = await sb
    .from('auth_identities')
    .select('id')
    .eq('user_id', userId)
    .eq('provider', 'phone')
    .eq('identifier', e164)
    .eq('verified', true)
    .maybeSingle<{ id: string }>()

  console.log('[bindVerifiedPhone] lookup own row', {
    hasOwn: !!own,
    error: ownErr?.message ?? null,
    errorCode: ownErr?.code ?? null,
    errorDetails: ownErr?.details ?? null,
    errorHint: ownErr?.hint ?? null,
    ts: Date.now(),
  })

  if (!ownErr && own) {
    console.log('[bindVerifiedPhone] already verified for this user', { ts: Date.now() })
    return { ok: true, alreadyVerified: true }
  }

  // Upsert into auth_identities (mark as verified)
  console.log('[bindVerifiedPhone] about to upsert', { userId, e164, ts: Date.now() })

  const { data: upsertData, error: upsertErr } = await sb
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
    .select()

  console.log('[bindVerifiedPhone] upsert result', {
    success: !upsertErr,
    data: upsertData ?? null,
    error: upsertErr?.message ?? null,
    errorCode: upsertErr?.code ?? null,
    errorDetails: upsertErr?.details ?? null,
    errorHint: upsertErr?.hint ?? null,
    ts: Date.now(),
  })

  if (upsertErr) {
    // 23505 = unique_violation. The pre-checks above cover the common paths, so
    // a 23505 here means a concurrent request won the race. Re-check who now owns
    // the verified row so we never misreport a constraint hit as a transient 500.
    console.error('[bindVerifiedPhone] upsert failed', {
      fullError: upsertErr,
      ts: Date.now(),
    })

    if ((upsertErr as { code?: string }).code === '23505') {
      const { data: winner } = await sb
        .from('auth_identities')
        .select('user_id')
        .eq('provider', 'phone')
        .eq('identifier', e164)
        .eq('verified', true)
        .maybeSingle<{ user_id: string }>()

      console.log('[bindVerifiedPhone] 23505 race re-check', {
        winnerUserId: winner?.user_id ?? null,
        isSelf: winner?.user_id === userId,
        ts: Date.now(),
      })

      if (winner?.user_id === userId) return { ok: true, alreadyVerified: true }
      if (winner) return { ok: false, error: 'phone_taken' }
    }
    return { ok: false, error: 'db_error' }
  }
  console.log('[bindVerifiedPhone] success', { ts: Date.now() })
  return { ok: true }
}
