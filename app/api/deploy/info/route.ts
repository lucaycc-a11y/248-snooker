// Deploy info endpoint - returns current branch states and gate status
// Admin-only, requires active admin_users entry

import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export const runtime = 'edge'

async function checkAdminAuth(supabase: ReturnType<typeof createRouteHandlerClient>) {
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

async function getGitHubBranchInfo(branch: string) {
  const token = process.env.GITHUB_TOKEN
  if (!token) {
    throw new Error('GITHUB_TOKEN not configured')
  }

  const response = await fetch(
    `https://api.github.com/repos/lucaycc-a11y/248-snooker/branches/${branch}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    }
  )

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`)
  }

  const data = await response.json()
  return {
    sha: data.commit.sha,
    message: data.commit.commit.message.split('\n')[0], // First line only
  }
}

export async function GET(req: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const auth = await checkAdminAuth(supabase)

    if (!auth.isAdmin) {
      return NextResponse.json({ error: auth.error }, { status: 403 })
    }

    // Get branch info from GitHub
    const [mainBranch, uatBranch] = await Promise.all([
      getGitHubBranchInfo('main'),
      getGitHubBranchInfo('uat'),
    ])

    // Check if branches are up to date
    const isUpToDate = mainBranch.sha === uatBranch.sha

    // Get gate status
    const { data: gateConfig } = await supabase
      .from('site_gate_config')
      .select('enabled')
      .eq('id', '00000000-0000-0000-0000-000000000001')
      .single()

    return NextResponse.json({
      mainBranch,
      uatBranch,
      isUpToDate,
      gateEnabled: gateConfig?.enabled || false,
    })
  } catch (error) {
    console.error('[deploy/info] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    )
  }
}
