import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { getAdminFollowUps } from '@/lib/data/getAdminFollowUps'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const admin = await getAdminData()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const days = parseInt(new URL(req.url).searchParams.get('days') ?? '14', 10) || 14
  const result = await getAdminFollowUps({ unpaidDays: days })
  if (result.error) return NextResponse.json({ error: result.error }, { status: 500 })
  return NextResponse.json(result)
}
