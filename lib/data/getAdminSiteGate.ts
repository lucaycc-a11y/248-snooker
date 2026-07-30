import { getServiceSupabase } from '@/lib/supabase/service'

// Data for /admin/site-gate: current gate state, IP whitelist, and recent
// access log. Mirrors getAdminMembers.ts's shape (service-role reads, never
// throws — falls back to safe empty state so the page always renders).

const CONFIG_ID = '00000000-0000-0000-0000-000000000001'
const LOG_PAGE_SIZE = 50

export type SiteGateWhitelistRow = { id: string; ipAddress: string; label: string | null; createdAt: string | null }
export type SiteGateLogRow = {
  id: string
  ipAddress: string | null
  method: string
  userAgent: string | null
  attemptedAt: string | null
}

export type AdminSiteGateData = {
  enabled: boolean
  hasPassword: boolean
  whitelist: SiteGateWhitelistRow[]
  log: SiteGateLogRow[]
}

export async function getAdminSiteGate(): Promise<AdminSiteGateData> {
  const service = getServiceSupabase()

  try {
    const [{ data: configRow }, { data: whitelistRows }, { data: logRows }] = await Promise.all([
      service.from('site_gate_config').select('enabled, password_hash').eq('id', CONFIG_ID).maybeSingle(),
      service
        .from('site_gate_ip_whitelist')
        .select('id, ip_address, label, created_at')
        .order('created_at', { ascending: false }),
      service
        .from('site_gate_access_log')
        .select('id, ip_address, method, user_agent, attempted_at')
        .order('attempted_at', { ascending: false })
        .limit(LOG_PAGE_SIZE),
    ])

    return {
      enabled: configRow?.enabled === true,
      hasPassword: Boolean(configRow?.password_hash),
      whitelist: ((whitelistRows ?? []) as Record<string, unknown>[]).map((r) => ({
        id: String(r.id),
        ipAddress: String(r.ip_address),
        label: (r.label as string | null) ?? null,
        createdAt: (r.created_at as string | null) ?? null,
      })),
      log: ((logRows ?? []) as Record<string, unknown>[]).map((r) => ({
        id: String(r.id),
        ipAddress: (r.ip_address as string | null) ?? null,
        method: String(r.method),
        userAgent: (r.user_agent as string | null) ?? null,
        attemptedAt: (r.attempted_at as string | null) ?? null,
      })),
    }
  } catch (err) {
    console.error('[admin/site-gate] query failed', err)
    return { enabled: false, hasPassword: false, whitelist: [], log: [] }
  }
}
