import { NextRequest, NextResponse } from "next/server"
import { getServiceSupabase } from "@/lib/supabase/service"

// Exchange a one-time code for a real Supabase session. The code is single-use
// and short-lived (5 minutes). Even if the exchange fails midway, the code is
// marked used to prevent replay attacks.
export async function POST(request: NextRequest) {
  const { code } = await request.json()
  if (!code || typeof code !== "string") {
    return NextResponse.json({ error: "無效的交換碼" }, { status: 400 })
  }

  const service = getServiceSupabase()

  // ── Look up the code ─────────────────────────────────────────────────
  const { data: exchangeRow, error: lookupError } = await service
    .from("login_exchange_codes")
    .select("code, admin_user_id, expires_at, used_at")
    .eq("code", code)
    .maybeSingle()

  if (lookupError || !exchangeRow) {
    return NextResponse.json({ error: "無效的交換碼" }, { status: 401 })
  }

  // ── Check expiry & usage ────────────────────────────────────────────
  const now = new Date()
  const expiresAt = new Date(exchangeRow.expires_at)

  if (exchangeRow.used_at) {
    return NextResponse.json({ error: "無效的交換碼" }, { status: 401 })
  }

  if (expiresAt < now) {
    // Mark expired code as used and return
    await service
      .from("login_exchange_codes")
      .update({ used_at: now.toISOString() })
      .eq("code", code)
    return NextResponse.json({ error: "無效的交換碼" }, { status: 401 })
  }

  // ── Mark as used NOW (prevent replay even if subsequent steps fail) ──
  const { error: markError } = await service
    .from("login_exchange_codes")
    .update({ used_at: now.toISOString() })
    .eq("code", code)

  if (markError) {
    console.error("[admin/exchange-session] Failed to mark code as used:", markError)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }

  // ── Look up the admin user ───────────────────────────────────────────
  const { data: adminRow } = await service
    .from("admin_users")
    .select("id, email, role, user_id, invite_status")
    .eq("id", exchangeRow.admin_user_id)
    .maybeSingle()

  if (!adminRow || adminRow.invite_status !== "active") {
    return NextResponse.json({ error: "帳號未啟用" }, { status: 403 })
  }

  if (!adminRow.user_id) {
    return NextResponse.json({ error: "帳號未綁定認證" }, { status: 403 })
  }

  // ── Create a session via the GoTrue Admin REST API ───────────────────
  // The GoTrue Admin API endpoint creates a session for a given user_id.
  // This is equivalent to the auth.admin.createSession() method available
  // in newer SDK versions, called directly since our version doesn't expose it.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  const sessionRes = await fetch(
    `${supabaseUrl}/auth/v1/admin/users/${adminRow.user_id}/sessions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
      },
    },
  )

  if (!sessionRes.ok) {
    const errText = await sessionRes.text().catch(() => "unknown")
    console.error("[admin/exchange-session] GoTrue admin API error:", {
      status: sessionRes.status,
      body: errText,
    })
    return NextResponse.json({ error: "無法建立 session" }, { status: 500 })
  }

  const sessionData = await sessionRes.json()

  return NextResponse.json({
    accessToken: sessionData.access_token ?? sessionData.accessToken,
    refreshToken: sessionData.refresh_token ?? sessionData.refreshToken,
    role: adminRow.role,
    email: adminRow.email,
    adminUserId: adminRow.id,
  })
}