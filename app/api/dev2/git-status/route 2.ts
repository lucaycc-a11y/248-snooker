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

    // Check if branches diverged
    const diverged = uatSha.trim() !== mainSha.trim()

    return NextResponse.json({
      uat: {
        sha: uatSha.trim().substring(0, 7),
        message: uatMsg.trim(),
      },
      main: {
        sha: mainSha.trim().substring(0, 7),
        message: mainMsg.trim(),
      },
      diverged,
    })
  } catch (error) {
    console.error('Error fetching git status:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
