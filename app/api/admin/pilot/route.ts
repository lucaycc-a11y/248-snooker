import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { looseRpc } from '@/lib/member/pilot-rpc'

export const dynamic = 'force-dynamic'

const KINDS = ['END_MATCH', 'ALARM', 'GRACE_10'] as const
type Kind = (typeof KINDS)[number]

function isKind(value: unknown): value is Kind {
  return typeof value === 'string' && (KINDS as readonly string[]).includes(value)
}

// The database functions check is_active_admin() themselves, so a non-admin session
// gets NOT_ADMIN here even if it reaches the route.
async function adminRpc(fn: string, args?: Record<string, unknown>) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { status: 401 as const, data: null }
  const { data, error } = await looseRpc(supabase)(fn, args)
  if (error) return { status: error.message.includes('NOT_ADMIN') ? (403 as const) : (500 as const), data: null }
  return { status: 200 as const, data }
}

// GET /api/admin/pilot — both rooms: live score, booking end, pending command.
export async function GET() {
  const res = await adminRpc('pilot_admin_overview')
  if (res.status !== 200) return NextResponse.json({ error: 'failed' }, { status: res.status })
  return NextResponse.json(res.data)
}

// POST /api/admin/pilot { device, kind } — END_MATCH, ALARM (red screen) or GRACE_10 (10 free minutes).
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { device?: unknown; kind?: unknown } | null
  const device = typeof body?.device === 'string' ? body.device : ''
  const kind = body?.kind
  if (!/^[0-9a-f-]{36}$/i.test(device) || !isKind(kind)) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }
  const res = await adminRpc('pilot_admin_command', { p_device: device, p_kind: kind })
  if (res.status !== 200) return NextResponse.json({ error: 'failed' }, { status: res.status })
  return NextResponse.json({ ok: true })
}
