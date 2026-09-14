// Dev2 Panel: Deploy Operations
// Push to main, maintenance mode deploy, go live

import { NextRequest, NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { getServiceSupabase } from '@/lib/supabase/service'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export const runtime = 'nodejs'

// GET - Check UAT vs main status
export async function GET() {
  const admin = await getAdminData()
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Get current branch HEAD info
    const { stdout: uatHead } = await execAsync('git rev-parse uat')
    const { stdout: mainHead } = await execAsync('git rev-parse main')
    const { stdout: uatMsg } = await execAsync('git log -1 --pretty=%B uat')
    const { stdout: mainMsg } = await execAsync('git log -1 --pretty=%B main')

    const uatSha = uatHead.trim().substring(0, 7)
    const mainSha = mainHead.trim().substring(0, 7)

    return NextResponse.json({
      uat: {
        sha: uatSha,
        message: uatMsg.trim(),
      },
      main: {
        sha: mainSha,
        message: mainMsg.trim(),
      },
      diverged: uatSha !== mainSha,
    })
  } catch (error) {
    console.error('[dev2/deploy] GET error:', error)
    return NextResponse.json({ error: 'Git operation failed' }, { status: 500 })
  }
}

// POST - Execute deploy action
export async function POST(req: NextRequest) {
  const admin = await getAdminData()
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { action, confirmation } = body

    // Validate confirmation
    if (action === 'push' && confirmation !== 'PUSH') {
      return NextResponse.json({ error: 'Invalid confirmation' }, { status: 400 })
    }
    if (action === 'go_live' && confirmation !== 'GO LIVE') {
      return NextResponse.json({ error: 'Invalid confirmation' }, { status: 400 })
    }

    const service = getServiceSupabase()

    // Check for in-flight deploy lock
    const { data: lockConfig } = await service
      .from('config')
      .select('deploy_lock')
      .eq('id', '00000000-0000-0000-0000-000000000001')
      .single()

    if (lockConfig?.deploy_lock) {
      return NextResponse.json({ error: 'Deploy already in progress' }, { status: 409 })
    }

    // Set deploy lock
    await service
      .from('config')
      .update({ deploy_lock: true })
      .eq('id', '00000000-0000-0000-0000-000000000001')

    try {
      if (action === 'push' || action === 'maintenance') {
        // Checkout main and merge uat
        await execAsync('git checkout main')
        await execAsync('git fetch origin')

        // Check if uat is ancestor of main (no actual changes)
        try {
          await execAsync('git merge-base --is-ancestor uat main')
          // uat is already in main, nothing to do
          return NextResponse.json({
            success: true,
            message: 'UAT branch is already merged into main',
            merged: false,
          })
        } catch {
          // uat has new commits, proceed with merge
        }

        // Attempt merge
        try {
          const { stdout: mergeOutput } = await execAsync('git merge uat --no-ff -m "Merge uat to main"')
          console.log('[dev2/deploy] merge output:', mergeOutput)
        } catch (mergeError: any) {
          // Check if it's a conflict
          if (mergeError.message.includes('CONFLICT')) {
            // Abort merge
            await execAsync('git merge --abort')
            return NextResponse.json(
              {
                error: 'Merge conflict detected',
                detail: 'Cannot auto-resolve conflicts. Manual merge required.',
              },
              { status: 409 }
            )
          }
          throw mergeError
        }

        // Push to main
        await execAsync('git push origin main')

        // If maintenance mode, enable gate
        if (action === 'maintenance') {
          await service
            .from('site_gate_config')
            .update({
              enabled: true,
              reason: 'maintenance',
              updated_by: admin.userId,
              updated_at: new Date().toISOString()
            })
            .eq('id', '00000000-0000-0000-0000-000000000001')
        }

        // Write audit log
        await service.from('audit_log').insert({
          admin_user_id: admin.userId,
          admin_email: admin.email,
          action: action === 'push' ? 'push_to_main' : 'push_to_maintenance',
          target_table: 'deployments',
          target_id: null,
          before_value: null,
          after_value: {
            action,
            timestamp: new Date().toISOString(),
          },
        })

        return NextResponse.json({
          success: true,
          message: action === 'push' ? 'Pushed to main successfully' : 'Deployed to maintenance mode',
          merged: true,
        })
      } else if (action === 'go_live') {
        // Check gate is currently enabled
        const { data: gateConfig } = await service
          .from('site_gate_config')
          .select('enabled')
          .eq('id', '00000000-0000-0000-0000-000000000001')
          .single()

        if (!gateConfig?.enabled) {
          return NextResponse.json({ error: 'Gate is not currently enabled' }, { status: 400 })
        }

        // Disable gate
        await service
          .from('site_gate_config')
          .update({ enabled: false, updated_by: admin.userId, updated_at: new Date().toISOString() })
          .eq('id', '00000000-0000-0000-0000-000000000001')

        // Write audit log
        await service.from('audit_log').insert({
          admin_user_id: admin.userId,
          admin_email: admin.email,
          action: 'end_maintenance',
          target_table: 'site_gate_config',
          target_id: '00000000-0000-0000-0000-000000000001',
          before_value: { enabled: true },
          after_value: { enabled: false },
        })

        return NextResponse.json({
          success: true,
          message: 'Site is now live',
        })
      } else {
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
      }
    } finally {
      // Release deploy lock
      await service
        .from('config')
        .update({ deploy_lock: false })
        .eq('id', '00000000-0000-0000-0000-000000000001')
    }
  } catch (error) {
    console.error('[dev2/deploy] POST error:', error)
    return NextResponse.json(
      {
        error: 'Deploy operation failed',
        detail: (error as Error).message,
      },
      { status: 500 }
    )
  }
}
