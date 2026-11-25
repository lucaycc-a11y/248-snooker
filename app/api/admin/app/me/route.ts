import { NextResponse } from 'next/server'
import { authenticateAppRequest } from '@/lib/admin/bearer-auth'

// iOS: "is the signed-in user an admin?"
//   401 -> missing / invalid / expired token
//   200 { isAdmin: false } -> valid user, not an admin
//   200 { isAdmin: true, role, ... } -> active admin
export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'no-store' }

export async function GET(req: Request) {
  const auth = await authenticateAppRequest(req)
  if (auth.status === 'unauthenticated') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE })
  }
  if (auth.status === 'not_admin') {
    return NextResponse.json({ isAdmin: false }, { headers: NO_STORE })
  }
  return NextResponse.json(
    {
      isAdmin: true,
      role: auth.role,
      userId: auth.userId,
      email: auth.email,
      displayName: auth.displayName,
    },
    { headers: NO_STORE },
  )
}
