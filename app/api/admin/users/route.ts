import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { getAdminMembers } from '@/lib/data/getAdminMembers'

export async function GET(req: Request) {
  const admin = await getAdminData()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const result = await getAdminMembers({
    page: parseInt(url.searchParams.get('page') ?? '1', 10) || 1,
    search: url.searchParams.get('search'),
  })
  return NextResponse.json(result)
}
