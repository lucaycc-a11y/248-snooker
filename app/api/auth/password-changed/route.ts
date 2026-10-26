import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getResend } from "@/lib/resend/client";

/**
 * POST /api/auth/password-changed
 *
 * Sends a password-changed notification email to the authenticated user.
 * Called by the update-password client page after a successful updatePassword().
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      return NextResponse.json({ ok: true }); // Best-effort — don't block
    }

    const resend = getResend();
    const ts = new Date().toLocaleString("en-HK", {
      timeZone: "Asia/Hong_Kong",
      dateStyle: "medium",
      timeStyle: "short",
    });

    await resend.emails.send({
      from: "Space8 <no-reply@space8.com.hk>",
      to: user.email,
      subject: "Your Space8 password was changed",
      html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display',sans-serif;max-width:600px;margin:0 auto;padding:48px 24px;background:#000;color:#fff;">
  <div style="text-align:center;padding-bottom:32px;">
    <img src="https://space8.com.hk/logos/space8-logo-email.png" alt="Space8" width="280" style="max-width:100%;height:auto;" />
  </div>
  <div style="background:#0a0a0a;border-radius:24px;padding:40px;border:1px solid rgba(34,197,94,0.2);">
    <div style="text-align:center;margin-bottom:20px;">
      <div style="display:inline-block;background:rgba(34,197,94,0.15);border-radius:50%;width:56px;height:56px;line-height:56px;">
        <span style="color:#22c55e;font-size:28px;">🔐</span>
      </div>
    </div>
    <h2 style="color:#fff;font-size:22px;font-weight:600;margin:0 0 12px;text-align:center;">Password Changed</h2>
    <p style="color:#a3a3a3;font-size:15px;line-height:1.6;margin:0 0 28px;text-align:center;">Your Space8 account password was changed successfully.</p>
    <div style="background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.2);border-radius:12px;padding:20px;margin-bottom:28px;">
      <p style="color:#a3a3a3;font-size:13px;margin:0 0 8px;"><strong style="color:#fff;">Time:</strong> ${ts}</p>
    </div>
    <p style="color:#737373;font-size:14px;line-height:1.6;text-align:center;margin:0;">If you didn't make this change, please contact support immediately to secure your account.</p>
  </div>
  <p style="color:#525252;font-size:12px;text-align:center;margin:32px 0 0;">Space8 · Hong Kong</p>
</div>`,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/auth/password-changed] notification failed:", err);
    return NextResponse.json({ ok: true }); // Non-blocking — password is already changed
  }
}
