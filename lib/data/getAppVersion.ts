// Admin-facing app version, from public.app_versions (service-role only).
// The newest version whose released_at is still in the future is a "(test)"
// build: admins see it before go-live; at released_at it flips to the official
// label automatically (computed from the clock, no redeploy or DB write needed).

import { unstable_noStore as noStore } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getServiceSupabase } from '@/lib/supabase/service'

// public.pricing_v2_config / public.app_versions are new and not yet in
// database.types.ts (regenerate types to drop this cast).
const db = () => getServiceSupabase() as unknown as SupabaseClient

export type AppVersionRow = {
  version: string
  releasedAt: string
  adds: string[]
  changes: string[]
  removes: string[]
  isTest: boolean
  label: string // e.g. "v8.0.1 (test)" or "v8.0.1"
}

function toRow(r: {
  version: string
  released_at: string
  adds: string[] | null
  changes: string[] | null
  removes: string[] | null
}, now: number): AppVersionRow {
  const isTest = new Date(r.released_at).getTime() > now
  return {
    version: r.version,
    releasedAt: r.released_at,
    adds: r.adds ?? [],
    changes: r.changes ?? [],
    removes: r.removes ?? [],
    isTest,
    label: `v${r.version}${isTest ? ' (test)' : ''}`,
  }
}

export async function getAppVersions(): Promise<AppVersionRow[]> {
  noStore()
  try {
    const { data, error } = await db()
      .from('app_versions')
      .select('version, released_at, adds, changes, removes')
      .order('released_at', { ascending: false })
    if (error || !data) return []
    const now = Date.now()
    return data.map((r) => toRow(r as never, now))
  } catch {
    return []
  }
}

/** The version to show in the admin header: newest row (test until its release time). */
export async function getCurrentAppVersion(): Promise<AppVersionRow | null> {
  const all = await getAppVersions()
  return all[0] ?? null
}
