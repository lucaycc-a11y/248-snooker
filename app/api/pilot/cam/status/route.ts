import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/service'
import { looseRpc } from '@/lib/member/pilot-rpc'

export const dynamic = 'force-dynamic'

// GET /api/pilot/cam/status?c=<code> — what the iPad shows right now (room, phase, score) for the phone camera page.
export async function GET(req: Request) {
  const code = new URL(req.url).searchParams.get('c') ?? ''
  if (!/^[0-9A-Za-z]{10}$/.test(code)) return NextResponse.json({ ok: false }, { status: 400 })
  const { data, error } = await looseRpc(getServiceSupabase())('pilot_cam_status', { p_code: code })
  if (error) return NextResponse.json({ ok: false }, { status: 500 })
  return NextResponse.json(data ?? { ok: false }, { headers: { 'Cache-Control': 'no-store' } })
}
