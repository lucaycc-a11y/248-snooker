// Supabase Edge Function: rotate-apple-secret
//
// Generates a fresh Apple "Sign in with Apple" client secret (an ES256-signed
// JWT) and pushes it into this project's Apple auth provider config via the
// Supabase Management API. Apple client secrets may live at most 6 months;
// this lets pg_cron rotate them automatically before they expire.
//
// Auth model: this function performs a privileged operation, so it must NOT be
// publicly invokable. It is deployed with --no-verify-jwt and instead checks a
// shared CRON_SECRET bearer token that only the pg_cron job knows.

import { SignJWT, importPKCS8 } from "npm:jose@5.9.6";
import { createClient } from "npm:@supabase/supabase-js@2";

// --- Apple developer account constants -------------------------------------
const TEAM_ID = "X7DHH2944M";
const CLIENT_ID = "com.formhk.248snooker.web"; // Apple Services ID
const KEY_ID = "WC6N6LR58J"; // the .p8 key's Key ID
const APPLE_AUD = "https://appleid.apple.com";
const SECRET_TTL_SECONDS = 15_777_000; // ~6 months (Apple's maximum)

const jsonHeaders = { "Content-Type": "application/json" };

Deno.serve(async (req) => {
  // 1. Authorize the caller. Only pg_cron, holding the shared secret, may run.
  const cronSecret = Deno.env.get("CRON_SECRET");
  const authHeader = req.headers.get("Authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: jsonHeaders,
    });
  }

  // Admin client for status logging. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
  // are auto-injected into every Edge Function — they are never set as secrets.
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceRoleKey);

  try {
    // 2. Load the Apple private key (.p8 PKCS#8 PEM content).
    const rawKey = Deno.env.get("APPLE_PRIVATE_KEY");
    if (!rawKey) throw new Error("APPLE_PRIVATE_KEY is not set");
    // Tolerate keys stored with escaped "\n" instead of real newlines.
    const pem = rawKey.includes("\\n") ? rawKey.replace(/\\n/g, "\n") : rawKey;
    const privateKey = await importPKCS8(pem, "ES256");

    // 3. Build and sign the Apple client secret JWT.
    const nowSec = Math.floor(Date.now() / 1000);
    const expSec = nowSec + SECRET_TTL_SECONDS;
    const clientSecret = await new SignJWT({})
      .setProtectedHeader({ alg: "ES256", kid: KEY_ID })
      .setIssuer(TEAM_ID)
      .setIssuedAt(nowSec)
      .setExpirationTime(expSec)
      .setAudience(APPLE_AUD)
      .setSubject(CLIENT_ID)
      .sign(privateKey);

    // 4. Push the new secret to the Apple auth provider via Management API.
    const accessToken = Deno.env.get("SB_MANAGEMENT_TOKEN");
    if (!accessToken) throw new Error("SB_MANAGEMENT_TOKEN is not set");
    // Prefer an explicit ref; otherwise derive it from the injected SUPABASE_URL.
    const projectRef = Deno.env.get("PROJECT_REF") ??
      new URL(supabaseUrl).hostname.split(".")[0];

    const res = await fetch(
      `https://api.supabase.com/v1/projects/${projectRef}/config/auth`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ external_apple_secret: clientSecret }),
      },
    );

    if (!res.ok) {
      // res.text() may contain Management API error detail; keep it server-side.
      const detail = await res.text();
      throw new Error(`Management API ${res.status}: ${detail}`);
    }

    // 5. Record success so the pg_cron gate knows when the next rotation is due.
    const expiresAt = new Date(expSec * 1000).toISOString();
    await admin
      .from("apple_secret_rotation")
      .update({
        last_rotated_at: new Date(nowSec * 1000).toISOString(),
        last_status: "ok",
        last_jwt_exp: expiresAt,
      })
      .eq("id", true);

    return new Response(JSON.stringify({ rotated: true, expiresAt }), {
      status: 200,
      headers: jsonHeaders,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Never leak key material or Management API detail to the caller.
    console.error("apple secret rotation failed:", message);
    // Best-effort failure log; do not mask the original error if this fails.
    try {
      await admin
        .from("apple_secret_rotation")
        .update({ last_status: `error: ${message.slice(0, 200)}` })
        .eq("id", true);
    } catch (_logErr) {
      // ignore — logging is best effort
    }
    return new Response(JSON.stringify({ error: "Rotation failed" }), {
      status: 500,
      headers: jsonHeaders,
    });
  }
});
