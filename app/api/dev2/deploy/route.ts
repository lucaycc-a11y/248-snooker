import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

async function checkAdminAuth() {
  const supabase = await createClient()
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

async function auditLog(userId: string, action: string, details: any) {
  const supabase = await createClient()
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

    const { enableGate } = await request.json()

    deployInProgress = true

    try {
      if (enableGate !== undefined) {
        // This is a push-to-production action (with or without gate)
        // Fetch latest
        await execAsync('git fetch origin')

        // Checkout main
        await execAsync('git checkout main')

        // Pull latest main
        await execAsync('git pull origin main')

        // Merge uat into main
        try {
          await execAsync('git merge uat --no-ff -m "Merge uat into main"')
        } catch (mergeError) {
          deployInProgress = false
          await execAsync('git merge --abort').catch(() => {})
          await execAsync('git checkout uat').catch(() => {})
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
          await execAsync('git checkout uat').catch(() => {})
          return NextResponse.json(
            { error: 'Merge verification failed' },
            { status: 500 }
          )
        }

        // Push to main
        await execAsync('git push origin main')

        const supabase = await createClient()

        // Update gate based on enableGate param
        await supabase
          .from('site_gate_config')
          .update({
            enabled: enableGate,
            reason: enableGate ? 'maintenance' : null
          })
          .eq('id', 1)

        await auditLog(userId, enableGate ? 'push_to_maintenance' : 'push_to_main', {
          from_branch: 'uat',
          to_branch: 'main',
          gate_enabled: enableGate,
        })

        // Return to uat branch
        await execAsync('git checkout uat')

        deployInProgress = false
        return NextResponse.json({
          success: true,
          message: enableGate
            ? 'Deploy successful. Site gate enabled. Vercel will deploy automatically.'
            : 'Deploy successful. Vercel will deploy automatically.',
        })
      } else {
        // This is a gate-only toggle (go-live action)
        const supabase = await createClient()
        await supabase
          .from('site_gate_config')
          .update({ enabled: false, reason: null })
          .eq('id', 1)

        await auditLog(userId, 'end_maintenance', {})

        deployInProgress = false
        return NextResponse.json({
          success: true,
          message: 'Site is now live',
        })
      }
    } catch (error) {
      deployInProgress = false
      throw error
    }
  } catch (error) {
    deployInProgress = false
    console.error('Deploy error:', error)
    return NextResponse.json(
      { error: `Internal error: ${error}` },
      { status: 500 }
    )
  }
}
