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

  if (!ownErr && own) return { ok: true, alreadyVerified: true }

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

  if (upsertErr) {
    // 23505 = unique_violation. The pre-checks above cover the common paths, so
    // a 23505 here means a concurrent request won the race. Re-check who now owns
    // the verified row so we never misreport a constraint hit as a transient 500.
    if ((upsertErr as { code?: string }).code === '23505') {
      const { data: winner } = await sb
        .from('auth_identities')
        .select('user_id')
        .eq('provider', 'phone')
        .eq('identifier', e164)
        .eq('verified', true)
        .maybeSingle<{ user_id: string }>()

      if (winner?.user_id === userId) return { ok: true, alreadyVerified: true }
      if (winner) return { ok: false, error: 'phone_taken' }
    }
    return { ok: false, error: 'db_error' }
  }
  return { ok: true }
}
