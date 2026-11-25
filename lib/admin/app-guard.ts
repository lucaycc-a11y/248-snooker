import { NextResponse } from 'next/server'
import { authenticateAppRequest } from '@/lib/admin/bearer-auth'

export const NO_STORE = { 'Cache-Control': 'no-store' } as const

export type AppAdmin = { userId: string; email: string; role: 'super_admin' | 'admin' }

/** Shared entry for /api/admin/app/*: 401 without a valid token, 403 for non-admins. */
export async function requireAppAdmin(
  req: Request,
): Promise<{ ok: true; admin: AppAdmin } | { ok: false; res: NextResponse }> {
  const auth = await authenticateAppRequest(req)
  if (auth.status === 'unauthenticated') {
    return { ok: false, res: NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE }) }
  }
  if (auth.status !== 'admin') {
    return { ok: false, res: NextResponse.json({ error: 'Admin access required' }, { status: 403, headers: NO_STORE }) }
  }
  return { ok: true, admin: { userId: auth.userId, email: auth.email, role: auth.role } }
}

export function jsonError(message: string, status = 400): NextResponse {
  return NextResponse.json({ error: message }, { status, headers: NO_STORE })
}

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

export async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const v: unknown = await req.json()
    return isRecord(v) ? v : null
  } catch {
    return null
  }
}
