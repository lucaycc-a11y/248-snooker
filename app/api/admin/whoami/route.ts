import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'

// Thin admin-identity check for the PUBLIC site (not /admin, which already
// has its own server-side layout guard). Phase B's edit-mode toggle needs to
// know "is this visitor an admin" before deciding whether to dynamically
// import the edit-mode JS bundle at all — non-admin visitors never load it.
// Returns only non-sensitive fields.

export async function GET() {
  const admin = await getAdminData()
  if (!admin) return NextResponse.json({ isAdmin: false })
  return NextResponse.json({ isAdmin: true, role: admin.role, email: admin.email })
}
