import { getServiceSupabase } from '@/lib/supabase/service'

export type SiteGateConfig = {
  enabled: boolean
  passwordHash: string | null
  passwordSalt: string | null
}

const CONFIG_ID = '00000000-0000-0000-0000-000000000001'
const TTL_MS = 60_000

type CacheEntry = { config: SiteGateConfig; whitelist: string[]; expiresAt: number }
let cache: CacheEntry | null = null

// Read the singleton site_gate_config row + IP whitelist, cached in-memory for
// TTL_MS so middleware doesn't hit the DB on every request. The cache is per
// serverless instance (no cross-instance invalidation), so admin changes take
// up to TTL_MS to propagate everywhere — acceptable for a pre-launch gate.
//
// Fails OPEN (gate treated as disabled) on any DB error: an unreachable DB
// should never lock visitors out of an otherwise-working site.
export async function getSiteGate(): Promise<{ config: SiteGateConfig; whitelist: string[] }> {
  const now = Date.now()
  if (cache && cache.expiresAt > now) {
    return { config: cache.config, whitelist: cache.whitelist }
  }

  try {
    const service = getServiceSupabase()
    const [{ data: configRow }, { data: whitelistRows }] = await Promise.all([
      service
        .from('site_gate_config')
        .select('enabled, password_hash, password_salt')
        .eq('id', CONFIG_ID)
        .maybeSingle(),
      service.from('site_gate_ip_whitelist').select('ip_address'),
    ])

    const config: SiteGateConfig = {
      enabled: configRow?.enabled === true,
      passwordHash: (configRow?.password_hash as string | null) ?? null,
      passwordSalt: (configRow?.password_salt as string | null) ?? null,
    }
    const whitelist = ((whitelistRows ?? []) as { ip_address: string }[]).map((r) => r.ip_address)

    cache = { config, whitelist, expiresAt: now + TTL_MS }
    return { config, whitelist }
  } catch (err) {
    console.error('[gate/config] read failed, failing open', err)
    return { config: { enabled: false, passwordHash: null, passwordSalt: null }, whitelist: [] }
  }
}
