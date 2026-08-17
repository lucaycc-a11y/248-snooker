import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getServiceSupabase } from "@/lib/supabase/service"
import crypto from "crypto"

// Redirect-scheme allowlist — prevents open-redirect attacks.
const ALLOWED_REDIRECT_SCHEMES = ["space8admin://auth"]

// Track failed attempts in-memory (server-wide). For a multi-instance
// deployment, replace with Redis or a DB table. Per-prompt spec: 5 failures
// → 15-minute lockout.
const failureMap = new Map<string, { count: number; lockedUntil: number }>()
const MAX_FAILURES = 5
const LOCKOUT_MS = 15 * 60 * 1000

function getClientIp(request: NextRequest): string {
  const fwd = request.headers.get("x-forwarded-for")
  if (fwd) return fwd.split(",")[0].trim()
  return request.headers.get("x-real-ip")?.trim() || "unknown"
}

export async function POST(request: NextRequest) {
  const { email, password, redirect } = await request.json()

  if (!email || !password) {
    return NextResponse.json({ error: "電郵或密碼不正確" }, { status: 400 })
  }

  const normalizedEmail = (email as string).trim().toLowerCase()
  const clientIp = getClientIp(request)

  // ── Check lockout ────────────────────────────────────────────────────
  const lockKey = normalizedEmail // lock by email
  const now = Date.now()
  const entry = failureMap.get(lockKey)
  if (entry && entry.lockedUntil > now) {
    return NextResponse.json(
      { error: "登入嘗試次數過多，請稍後再試", lockedUntil: entry.lockedUntil },
      { status: 429 },
    )
  }
  // Clear expired lockout
  if (entry && entry.lockedUntil <= now) {
    failureMap.delete(lockKey)
  }

  // ── Validate redirect scheme ─────────────────────────────────────────
  const redirectScheme = (redirect as string | undefined) ?? ""
  if (redirectScheme && !ALLOWED_REDIRECT_SCHEMES.includes(redirectScheme)) {
    return NextResponse.json({ error: "無效的重新導向" }, { status: 400 })
  }

  // ── Authenticate via Supabase Auth ───────────────────────────────────
  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password: password as string,
  })

  if (authError || !authData.user) {
    // Record failure — same message for wrong password or non-existent email
    const failEntry = failureMap.get(lockKey) ?? { count: 0, lockedUntil: 0 }
    failEntry.count++
    if (failEntry.count >= MAX_FAILURES) {
      failEntry.lockedUntil = now + LOCKOUT_MS
      failEntry.count = 0
    }
    failureMap.set(lockKey, failEntry)
    return NextResponse.json({ error: "電郵或密碼不正確" }, { status: 401 })
  }

  // ── Check admin_users — must be active ───────────────────────────────
  const service = getServiceSupabase()
  const { data: adminRow } = await service
    .from("admin_users")
    .select("id, email, role, invite_status")
    .eq("email", normalizedEmail)
    .maybeSingle()

  if (!adminRow || adminRow.invite_status !== "active") {
    // Clear Auth session — this user has a Supabase account but isn't an
    // active admin. Don't let them keep the session.
    await supabase.auth.signOut()
    return NextResponse.json(
      { error: "這個帳號未啟用，請聯絡管理員" },
      { status: 403 },
    )
  }

  // ── Sign out the web session (we only need the exchange code) ────────
  // Don't keep the Supabase session on the device — the iOS app will get
  // its own session via the exchange endpoint.
  await supabase.auth.signOut()

  // ── Generate exchange code ───────────────────────────────────────────
  const code = crypto.randomBytes(32).toString("hex")
  const expiresAt = new Date(now + 5 * 60 * 1000).toISOString()

  const { error: insertError } = await service
    .from("login_exchange_codes")
    .insert({
      code,
      admin_user_id: adminRow.id,
      redirect_scheme: redirectScheme,
      expires_at: expiresAt,
    })

  if (insertError) {
    console.error("[admin/login] Failed to insert exchange code:", insertError)
    return NextResponse.json({ error: "伺服器錯誤，請稍後再試" }, { status: 500 })
  }

  // ── Clear failure record on success ──────────────────────────────────
  failureMap.delete(lockKey)

  // ── Build redirect URL ───────────────────────────────────────────────
  const redirectUrl = redirectScheme
    ? `${redirectScheme}?code=${code}`
    : `/admin?code=${code}`

  return NextResponse.json({ redirectUrl })
}