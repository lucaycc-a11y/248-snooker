import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

async function checkAdminAuth() {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) return false

  const { data: adminData } = await supabase
    .from('admin_users')
    .select('is_active')
    .eq('user_id', session.user.id)
    .single()

  return adminData?.is_active || false
}

export async function GET() {
  try {
    if (!(await checkAdminAuth())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get current branch commits
    const { stdout: uatSha } = await execAsync('git rev-parse uat')
    const { stdout: uatMsg } = await execAsync('git log -1 --pretty=%s uat')
    const { stdout: mainSha } = await execAsync('git rev-parse main')
    const { stdout: mainMsg } = await execAsync('git log -1 --pretty=%s main')

    // Count commits ahead
    let uatAhead = 0
    try {
      const { stdout: aheadCount } = await execAsync('git rev-list main..uat --count')
      uatAhead = parseInt(aheadCount.trim(), 10) || 0
    } catch {
      // If this fails, just use 0
    }

    // Get gate status
    const supabase = await createClient()
    const { data: gateData } = await supabase
      .from('site_gate_config')
      .select('enabled')
      .eq('id', 1)
      .single()

    return NextResponse.json({
      uatSha: uatSha.trim(),
      uatMessage: uatMsg.trim(),
      mainSha: mainSha.trim(),
      mainMessage: mainMsg.trim(),
      uatAhead,
      gateEnabled: gateData?.enabled || false,
    })
  } catch (error) {
    console.error('Error fetching git status:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
