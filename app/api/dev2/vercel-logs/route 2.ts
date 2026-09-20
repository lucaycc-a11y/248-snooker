// Dev2 Panel: Vercel Logs
// Fetches recent Vercel build and runtime logs via Vercel API

import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'

export const runtime = 'nodejs'

const VERCEL_TOKEN = process.env.VERCEL_TOKEN
const PROJECT_ID = 'prj_JXjsQQWd9kUTRwU70Lwya9SBbHki'
const TEAM_ID = 'lucaycc-3022s-projects'

export async function GET() {
  const admin = await getAdminData()
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!VERCEL_TOKEN) {
    return NextResponse.json({ error: 'Vercel token not configured' }, { status: 500 })
  }

  try {
    // Fetch recent deployments
    const deploymentsRes = await fetch(
      `https://api.vercel.com/v6/deployments?projectId=${PROJECT_ID}&teamId=${TEAM_ID}&limit=5`,
      {
        headers: {
          Authorization: `Bearer ${VERCEL_TOKEN}`,
        },
      }
    )

    if (!deploymentsRes.ok) {
      throw new Error(`Vercel API error: ${deploymentsRes.status}`)
    }

    const deploymentsData = await deploymentsRes.json()
    const deployments = deploymentsData.deployments || []

    // Get the most recent deployment
    const latestDeployment = deployments[0]

    let runtimeLogs: unknown[] = []
    if (latestDeployment?.uid) {
      // Fetch runtime logs for the latest deployment
      const logsRes = await fetch(
        `https://api.vercel.com/v2/deployments/${latestDeployment.uid}/events?teamId=${TEAM_ID}&limit=100`,
        {
          headers: {
            Authorization: `Bearer ${VERCEL_TOKEN}`,
          },
        }
      )

      if (logsRes.ok) {
        runtimeLogs = await logsRes.json()
      }
    }

    return NextResponse.json({
      latestDeployment: latestDeployment
        ? {
            uid: latestDeployment.uid,
            url: latestDeployment.url,
            state: latestDeployment.state,
            createdAt: latestDeployment.createdAt,
            creator: latestDeployment.creator?.username,
            target: latestDeployment.target,
          }
        : null,
      recentDeployments: deployments.slice(0, 5).map((d: any) => ({
        uid: d.uid,
        url: d.url,
        state: d.state,
        createdAt: d.createdAt,
        target: d.target,
      })),
      runtimeLogs,
    })
  } catch (error) {
    console.error('[dev2/vercel-logs] error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch Vercel logs', detail: (error as Error).message },
      { status: 500 }
    )
  }
}
