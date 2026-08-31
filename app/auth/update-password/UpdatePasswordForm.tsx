"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import PasswordStrength from "@/components/auth/PasswordStrength";
import { validatePassword } from "@/lib/auth/password";

const GREEN = "#22c55e";
const INK = "#f5f5f7";
const SUBTLE = "#A1A1A6";
const BORDER = "rgba(255,255,255,0.1)";
const DANGER = "#FF453A";
const FONT_FAMILY = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif";

/**
 * C6 item 13: Password recovery client form — shown after the user clicks the
 * reset-password link from their email. The recovery link includes a
 * `token_hash` query param; we exchange it for a session via Supabase's
 * verifyOtp, then let the user set a new password.
 *
 * Rendered inside a NextIntlClientProvider by page.tsx (server component)
 * following the /login pattern.
 */
export default function UpdatePasswordForm() {
  const t = useTranslations("auth");
  const router = useRouter();
  const supabase = createClient();

  const [status, setStatus] = useState<"loading" | "form" | "success" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  // ── Exchange recovery token for session on mount ────────────────────────
  const exchangeToken = useCallback(async () => {
    try {
      const url = new URL(window.location.href);

      // Supabase recovery links pass token_hash as a search param.
      // Also check the hash fragment in case older templates use # access_token.
      let tokenHash = url.searchParams.get("token_hash");
      let type = url.searchParams.get("type");

      if (!tokenHash && window.location.hash) {
        const hashParams = new URLSearchParams(window.location.hash.slice(1));
        tokenHash = hashParams.get("token_hash") ?? hashParams.get("access_token");
        type = hashParams.get("type") ?? "recovery";
      }

      if (!tokenHash || type !== "recovery") {
        setStatus("error");
        setErrorMsg(t("update_password_err_invalid_link"));
        return;
      }

      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: "recovery",
      });

      if (error) {
        console.error("[update-password] token exchange failed:", error.message);
        setStatus("error");
        setErrorMsg(t("update_password_err_expired"));
        return;
      }

      setStatus("form");
    } catch (err) {
      console.error("[update-password] unexpected error:", err);
      setStatus("error");
      setErrorMsg(t("update_password_err_expired"));
    }
  }, [supabase, t]);

  useEffect(() => {
    exchangeToken();
  }, [exchangeToken]);

  // ── Submit new password ──────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    const trimmed = password.trim();
    const confirmTrimmed = confirm.trim();

    if (trimmed !== confirmTrimmed) {
      setErrorMsg(t("update_password_err_mismatch"));
      return;
    }

    const check = validatePassword(trimmed);
    if (!check.ok) {
      setErrorMsg(t("err_password_weak"));
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: trimmed });
      if (error) {
        console.error("[update-password] updateUser failed:", error.message);
        setErrorMsg(t("update_password_err_generic"));
        return;
      }

      // Notify the user via email (best-effort)
      try {
        await fetch("/api/auth/password-changed", { method: "POST" });
      } catch {
        // Password is already changed — email notification is non-blocking
      }

      setStatus("success");
      setTimeout(() => router.push("/member"), 2000);
    } catch {
      setErrorMsg(t("update_password_err_generic"));
    } finally {
      setSaving(false);
    }
  };

  // ── Loading state ────────────────────────────────────────────────────────
  if (status === "loading") {
    return (
      <div style={{ fontFamily: FONT_FAMILY, textAlign: "center", padding: "48px 24px" }}>
        <p style={{ color: SUBTLE, fontSize: "15px" }}>{t("update_password_verifying")}</p>
      </div>
    );
  }

  // ── Invalid/expired token ────────────────────────────────────────────────
  if (status === "error") {
    return (
      <div style={{ fontFamily: FONT_FAMILY, textAlign: "center", padding: "48px 24px", maxWidth: 420 }}>
        <div
          style={{
            background: "rgba(255,69,58,0.12)",
            borderRadius: "50%",
            width: 64,
            height: 64,
            lineHeight: "64px",
            margin: "0 auto 20px",
          }}
        >
          <span style={{ color: DANGER, fontSize: "28px" }}>✕</span>
        </div>
        <h2 style={{ color: INK, fontSize: "20px", fontWeight: 600, margin: "0 0 12px" }}>
          {t("update_password_err_title")}
        </h2>
        <p style={{ color: SUBTLE, fontSize: "14px", lineHeight: 1.6, margin: "0 0 28px" }}>{errorMsg}</p>
        <button
          type="button"
          onClick={() => router.push("/login")}
          style={{
            minHeight: 48,
            padding: "0 24px",
            borderRadius: "12px",
            border: `1px solid ${BORDER}`,
            background: "transparent",
            color: GREEN,
            fontSize: "15px",
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: FONT_FAMILY,
          }}
        >
          {t("update_password_back_to_login")}
        </button>
      </div>
    );
  }

  // ── Success state ────────────────────────────────────────────────────────
  if (status === "success") {
    return (
      <div style={{ fontFamily: FONT_FAMILY, textAlign: "center", padding: "48px 24px" }}>
        <div
          style={{
            background: "rgba(34,197,94,0.12)",
            borderRadius: "50%",
            width: 64,
            height: 64,
            lineHeight: "64px",
            margin: "0 auto 20px",
          }}
        >
          <span style={{ color: GREEN, fontSize: "28px" }}>✓</span>
        </div>
        <h2 style={{ color: INK, fontSize: "20px", fontWeight: 600, margin: "0 0 12px" }}>
          {t("update_password_success_title")}
        </h2>
        <p style={{ color: SUBTLE, fontSize: "14px", lineHeight: 1.6, margin: 0 }}>
          {t("update_password_success_body")}
        </p>
      </div>
    );
  }

  // ── Password form ────────────────────────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    width: "100%",
    minHeight: 48,
    padding: "0 16px",
    borderRadius: "12px",
    border: `1px solid ${BORDER}`,
    background: "rgba(0,0,0,0.25)",
    color: INK,
    fontSize: "15px",
    fontFamily: FONT_FAMILY,
    outline: "none",
    boxSizing: "border-box",
  };

  return (
    <div style={{ fontFamily: FONT_FAMILY, maxWidth: 420, width: "100%" }}>
      <h2
        style={{ color: INK, fontSize: "22px", fontWeight: 600, margin: "0 0 8px", textAlign: "center" }}
        data-cms-key="auth.update_password_title"
      >
        {t("update_password_title")}
      </h2>
      <p
        style={{ color: SUBTLE, fontSize: "14px", lineHeight: 1.6, margin: "0 0 28px", textAlign: "center" }}
        data-cms-key="auth.update_password_subtitle"
      >
        {t("update_password_subtitle")}
      </p>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <label style={{ display: "block" }}>
          <span style={{ display: "block", fontSize: "13px", color: SUBTLE, marginBottom: 8 }}>
            {t("password_required")}
          </span>
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("password_placeholder")}
            required
            style={inputStyle}
          />
        </label>

        <PasswordStrength value={password} />

        <label style={{ display: "block" }}>
          <span style={{ display: "block", fontSize: "13px", color: SUBTLE, marginBottom: 8 }}>
            {t("update_password_confirm")}
          </span>
          <input
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={t("update_password_confirm_placeholder")}
            required
            style={inputStyle}
          />
        </label>

        {errorMsg && (
          <p style={{ color: DANGER, fontSize: "13px", margin: 0 }}>{errorMsg}</p>
        )}

        <button
          type="submit"
          disabled={saving || !password || !confirm}
          style={{
            minHeight: 52,
            borderRadius: "14px",
            border: "none",
            background: GREEN,
            color: "#0a0a0a",
            fontSize: "16px",
            fontWeight: 700,
            cursor: saving ? "default" : "pointer",
            opacity: saving || !password || !confirm ? 0.5 : 1,
            fontFamily: FONT_FAMILY,
          }}
          data-cms-key="auth.update_password_submit"
        >
          {saving ? t("saving") : t("update_password_submit")}
        </button>
      </form>
    </div>
  );
}
