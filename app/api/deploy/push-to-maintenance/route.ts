// Push to Maintenance endpoint - merges uat → main, enables gate
// Admin-only, with in-flight lock to prevent concurrent merges

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'edge'

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  )
}

async function checkAdminAuth(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { isAdmin: false, user: null, error: 'Not authenticated' }
  }

  const { data: adminEntry } = await supabase
    .from('admin_users')
    .select('user_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  return {
    isAdmin: !!adminEntry,
    user,
    adminRole: adminEntry?.role || null,
    error: adminEntry ? null : 'Not authorized - admin access required',
  }
}

async function checkMergeLock(supabase: Awaited<ReturnType<typeof createClient>>): Promise<boolean> {
  // Check if a merge is already in progress (simple lock via config table)
  const { data: config } = await supabase
    .from('config')
    .select('value')
    .eq('key', 'deploy_merge_in_progress')
    .single()

  if (!config) return false

  const lockData = config.value as { locked: boolean; timestamp: number }
  if (!lockData.locked) return false

  // Auto-release stale locks (older than 5 minutes)
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
  if (lockData.timestamp < fiveMinutesAgo) {
    await supabase
      .from('config')
      .update({ value: { locked: false, timestamp: 0 } })
      .eq('key', 'deploy_merge_in_progress')
    return false
  }

  return true
}

async function acquireMergeLock(supabase: Awaited<ReturnType<typeof createClient>>): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('config')
      .upsert({
        key: 'deploy_merge_in_progress',
        value: { locked: true, timestamp: Date.now() },
      })
    return !error
  } catch {
    return false
  }
}

async function releaseMergeLock(supabase: Awaited<ReturnType<typeof createClient>>) {
  await supabase
    .from('config')
    .update({ value: { locked: false, timestamp: 0 } })
    .eq('key', 'deploy_merge_in_progress')
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  try {
    const auth = await checkAdminAuth(supabase)
    if (!auth.isAdmin || !auth.user) {
      return NextResponse.json({ error: auth.error }, { status: 403 })
    }

    // Check for existing merge in progress
    const isLocked = await checkMergeLock(supabase)
    if (isLocked) {
      return NextResponse.json(
        { error: 'A merge is already in progress. Please wait.' },
        { status: 409 }
      )
    }

    // Acquire lock
    const lockAcquired = await acquireMergeLock(supabase)
    if (!lockAcquired) {
      return NextResponse.json({ error: 'Failed to acquire merge lock' }, { status: 500 })
    }

    try {
      const token = process.env.GITHUB_TOKEN
      if (!token) {
        throw new Error('GITHUB_TOKEN not configured')
      }

      // Get current main and uat branch SHAs
      const [mainResponse, uatResponse] = await Promise.all([
        fetch('https://api.github.com/repos/lucaycc-a11y/248-snooker/branches/main', {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github.v3+json',
          },
        }),
        fetch('https://api.github.com/repos/lucaycc-a11y/248-snooker/branches/uat', {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github.v3+json',
          },
        }),
      ])

      if (!mainResponse.ok || !uatResponse.ok) {
        throw new Error('Failed to fetch branch info')
      }

      const mainData = await mainResponse.json()
      const uatData = await uatResponse.json()

      const beforeMainSha = mainData.commit.sha
      const uatSha = uatData.commit.sha

      // Check if already up to date
      if (beforeMainSha === uatSha) {
        await releaseMergeLock(supabase)
        return NextResponse.json({ error: 'Branches already up to date' }, { status: 400 })
      }

      // Merge uat into main
      const mergeResponse = await fetch('https://api.github.com/repos/lucaycc-a11y/248-snooker/merges', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          base: 'main',
          head: 'uat',
          commit_message: 'Push to Maintenance: merge uat → main',
        }),
      })

      if (!mergeResponse.ok) {
        const errorData = await mergeResponse.json()
        throw new Error(errorData.message || 'Merge failed')
      }

      const mergeData = await mergeResponse.json()
      const afterMainSha = mergeData.sha

      // Get current gate status
      const { data: gateConfigBefore } = await supabase
        .from('site_gate_config')
        .select('enabled')
        .eq('id', '00000000-0000-0000-0000-000000000001')
        .single()

      // Enable gate (set to true)
      await supabase
        .from('site_gate_config')
        .update({ enabled: true, updated_at: new Date().toISOString(), updated_by: auth.user.id })
        .eq('id', '00000000-0000-0000-0000-000000000001')

      // Write audit log
      await supabase.from('audit_log').insert({
        admin_user_id: auth.user.id,
        admin_email: auth.user.email,
        action: 'push_to_maintenance',
        target_table: 'site_gate_config',
        target_id: '00000000-0000-0000-0000-000000000001',
        before_value: {
          mainSha: beforeMainSha,
          uatSha,
          gateEnabled: gateConfigBefore?.enabled || false,
        },
        after_value: {
          mainSha: afterMainSha,
          uatSha,
          gateEnabled: true,
        },
        ip_address: getClientIp(req),
      })

      // Release lock
      await releaseMergeLock(supabase)

      return NextResponse.json({
        success: true,
        commitSha: afterMainSha,
        message: 'Merged uat → main, gate enabled',
      })
    } catch (error) {
      // Release lock on error
      await releaseMergeLock(supabase)
      throw error
    }
  } catch (error) {
    console.error('[deploy/push-to-maintenance] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    )
  }
}
