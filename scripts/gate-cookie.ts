#!/usr/bin/env tsx
/**
 * scripts/gate-cookie.ts
 *
 * Generates a signed site-gate bypass cookie for Playwright tests running
 * against the UAT environment. Reads the current password_version from the DB
 * so the cookie is always valid for the active password.
 *
 * Usage:
 *   npx tsx scripts/gate-cookie.ts
 *
 * Prints a JSON object to stdout — the Playwright cookie shape accepted by
 * context.addCookies([]).
 *
 * Required env vars:
 *   GATE_COOKIE_SECRET          — must match the value set in Vercel UAT
 *   NEXT_PUBLIC_SUPABASE_URL    — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY   — service-role key (never anon key)
 *
 * Optional:
 *   GATE_COOKIE_DOMAIN          — default: uat.space8.com.hk
 *   GATE_COOKIE_MAX_AGE_SECONDS — lifetime override for non-production (default 3600)
 *
 * Hard-fails if NEXT_PUBLIC_APP_ENV === 'production' so this script can never
 * be run against the live site by mistake.
 */

import { createClient } from '@supabase/supabase-js'
import { signGateCookie, GATE_COOKIE_NAME } from '../lib/gate/cookie'

const CONFIG_ID = '00000000-0000-0000-0000-000000000001'

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) {
    console.error(`[gate-cookie] Missing required env var: ${name}`)
    process.exit(1)
  }
  return v
}

async function main() {
  if (process.env.NEXT_PUBLIC_APP_ENV === 'production') {
    console.error('[gate-cookie] Refusing to run on production. Set NEXT_PUBLIC_APP_ENV to uat or development.')
    process.exit(1)
  }

  const secret = requireEnv('GATE_COOKIE_SECRET')
  const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL')
  const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  })

  const { data, error } = await supabase
    .from('site_gate_config')
    .select('password_version')
    .eq('id', CONFIG_ID)
    .maybeSingle()

  if (error) {
    console.error('[gate-cookie] Failed to read password_version from DB:', error.message)
    process.exit(1)
  }

  const passwordVersion = (data?.password_version as number | null) ?? 1
  const cookieValue = await signGateCookie(secret, passwordVersion)

  const maxAge =
    parseInt(process.env.GATE_COOKIE_MAX_AGE_SECONDS ?? '', 10) || 3600

  const output = {
    name: GATE_COOKIE_NAME,
    value: cookieValue,
    domain: process.env.GATE_COOKIE_DOMAIN ?? 'uat.space8.com.hk',
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'Lax' as const,
    expires: Math.floor(Date.now() / 1000) + maxAge,
  }

  process.stdout.write(JSON.stringify(output) + '\n')
}

main().catch((err) => {
  console.error('[gate-cookie] Unexpected error:', err)
  process.exit(1)
})
