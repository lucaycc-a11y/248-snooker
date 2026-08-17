import { NextRequest, NextResponse } from "next/server"
import { getServiceSupabase } from "@/lib/supabase/service"

// App-side logout: revoke the refresh token server-side so the session is
// truly dead (not just Keychain-cleared locally).
export async function POST(request: NextRequest) {
  const { refreshToken } = await request.json()

  if (!refreshToken || typeof refreshToken !== "string") {
    return NextResponse.json({ ok: false, error: "缺少 refresh token" }, { status: 400 })
  }

  const service = getServiceSupabase()

  const { error } = await service.auth.admin.signOut(refreshToken)

  if (error) {
    // Token may already be invalid — still report ok so the client clears
    // its local session regardless.
    console.error("[admin/logout] Revoke failed:", error)
    return NextResponse.json({ ok: true, alreadyInvalid: true })
  }

  return NextResponse.json({ ok: true })
}