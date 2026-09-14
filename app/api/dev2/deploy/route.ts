import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

async function checkAdminAuth() {
  const supabase = createRouteHandlerClient({ cookies })
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) return { authorized: false, userId: null }

  const { data: adminData } = await supabase
    .from('admin_users')
    .select('is_active')
    .eq('user_id', session.user.id)
    .single()

  return {
    authorized: adminData?.is_active || false,
    userId: session.user.id,
  }
}

async function auditLog(supabase: any, userId: string, action: string, details: any) {
  await supabase.from('audit_log').insert({
    user_id: userId,
    action,
    details,
    created_at: new Date().toISOString(),
  })
}

// Check for in-flight deploy lock
let deployInProgress = false

export async function POST(request: NextRequest) {
  try {
    const { authorized, userId } = await checkAdminAuth()
    if (!authorized || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (deployInProgress) {
      return NextResponse.json(
        { error: 'Deploy already in progress' },
        { status: 409 }
      )
    }

    const { action, confirmation } = await request.json()

    // Validate confirmation
    if (action === 'push' && confirmation !== 'PUSH') {
      return NextResponse.json({ error: 'Invalid confirmation' }, { status: 400 })
    }
    if (action === 'go-live' && confirmation !== 'GO LIVE') {
      return NextResponse.json({ error: 'Invalid confirmation' }, { status: 400 })
    }

    deployInProgress = true
    const supabase = createRouteHandlerClient({ cookies })

    try {
      if (action === 'push' || action === 'maintenance') {
        // Checkout main
        await execAsync('git checkout main')

        // Merge uat into main
        try {
          await execAsync('git merge uat --no-ff')
        } catch (mergeError) {
          deployInProgress = false
          return NextResponse.json(
            { error: 'Merge conflict detected. Resolve manually.' },
            { status: 409 }
          )
        }

        // Verify merge
        const { stdout: isAncestor } = await execAsync(
          'git merge-base --is-ancestor uat main && echo "yes" || echo "no"'
        )

        if (isAncestor.trim() !== 'yes') {
          deployInProgress = false
          return NextResponse.json(
            { error: 'Merge verification failed' },
            { status: 500 }
          )
        }

        // Push to main
        await execAsync('git push origin main')

        // If maintenance mode, force gate on
        if (action === 'maintenance') {
          await supabase
            .from('site_gate_config')
            .update({ enabled: true, reason: 'maintenance' })
            .eq('id', 1)

          await auditLog(supabase, userId, 'push_to_maintenance', {
            from_branch: 'uat',
            to_branch: 'main',
          })
        } else {
          await auditLog(supabase, userId, 'push_to_main', {
            from_branch: 'uat',
            to_branch: 'main',
          })
        }

        // Return to uat branch
        await execAsync('git checkout uat')

        deployInProgress = false
        return NextResponse.json({
          success: true,
          action,
          message: 'Deploy successful',
        })
      } else if (action === 'go-live') {
        // Open the gate
        await supabase
          .from('site_gate_config')
          .update({ enabled: false, reason: null })
          .eq('id', 1)

        await auditLog(supabase, userId, 'end_maintenance', {})

        deployInProgress = false
        return NextResponse.json({
          success: true,
          action,
          message: 'Site is now live',
        })
      }

      deployInProgress = false
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    } catch (error) {
      deployInProgress = false
      throw error
    }
  } catch (error) {
    deployInProgress = false
    console.error('Deploy error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
