"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { SITE_CONTACT } from "@/lib/site/contact";

type DeleteDataModalProps = {
  isOpen: boolean;
  onClose: () => void;
  /** Kept for API compatibility; the modal now runs the server flow itself. */
  onConfirm?: () => Promise<void>;
  userEmail?: string | null;
  hasActiveBookings: boolean;
};

type Step = "warn" | "sending" | "verify" | "done";

type ApiBody = {
  ok?: boolean;
  code?: string;
  maskedEmail?: string;
  remaining?: number;
  retryAfter?: number;
  scheduledPurgeAt?: string;
};

const ERROR_CODES = new Set([
  "active_bookings", "admin_account", "already_deleted", "no_email", "cooldown",
  "rate_limited", "email_failed", "code_wrong", "code_invalid", "code_expired", "too_many_attempts",
]);

async function post(url: string, body?: unknown): Promise<ApiBody> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json: unknown = await res.json().catch(() => ({}));
    return typeof json === "object" && json !== null ? (json as ApiBody) : {};
  } catch {
    return {};
  }
}

/**
 * Account deletion (PDPO A20): warn → email code → verify → deactivated.
 * Deactivation is immediate; personal data is purged 180 days later, and
 * signing in before then restores the account. All rules are enforced on the
 * server — the active-booking flag here only pre-empts an obvious rejection.
 */
export default function DeleteDataModal({ isOpen, onClose }: DeleteDataModalProps) {
  const t = useTranslations("deleteAccount");
  const [step, setStep] = useState<Step>("warn");
  const [code, setCode] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [purgeDate, setPurgeDate] = useState("");

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(id);
  }, [cooldown]);

  if (!isOpen) return null;

  const showError = (body: ApiBody) => {
    const c = body.code && ERROR_CODES.has(body.code) ? body.code : "generic";
    setErrorCode(c);
    setError(c === "code_wrong" ? t("err_code_wrong", { remaining: body.remaining ?? 0 }) : t(`err_${c}`));
  };

  const reset = () => {
    setStep("warn"); setCode(""); setError(null); setErrorCode(null); setBusy(false);
  };

  const handleClose = () => {
    if (busy) return;
    if (step === "done") { window.location.href = "/"; return; }
    reset();
    onClose();
  };

  const sendCode = async (fromStep: Step) => {
    setBusy(true); setError(null); setErrorCode(null);
    if (fromStep === "warn") setStep("sending");
    const body = await post("/api/member/delete-account/send-code");
    setBusy(false);
    if (body.ok) {
      setMaskedEmail(body.maskedEmail ?? "");
      setCooldown(60);
      setCode("");
      setStep("verify");
      return;
    }
    if (body.code === "cooldown" && body.retryAfter) setCooldown(body.retryAfter);
    setStep(fromStep === "warn" ? "warn" : "verify");
    showError(body);
  };

  const confirm = async () => {
    setBusy(true); setError(null); setErrorCode(null);
    const body = await post("/api/member/delete-account/confirm", { code });
    setBusy(false);
    if (body.ok) {
      const iso = body.scheduledPurgeAt ?? "";
      setPurgeDate(iso ? new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) : "");
      setStep("done");
      return;
    }
    if (body.code === "too_many_attempts" || body.code === "code_expired" || body.code === "code_invalid") setCode("");
    showError(body);
  };

  const btn = (primary: boolean, disabled: boolean): React.CSSProperties => ({
    padding: "12px 20px", minHeight: 44, borderRadius: "10px", fontSize: "15px",
    fontWeight: primary ? 600 : 500, cursor: disabled ? "not-allowed" : "pointer",
    border: primary ? "none" : "1px solid rgba(255,255,255,0.2)",
    background: primary ? (disabled ? "rgba(255,69,58,0.35)" : "#FF453A") : "rgba(255,255,255,0.05)",
    color: "#fff", opacity: disabled ? 0.6 : 1,
  });
  const muted: React.CSSProperties = { fontSize: "15px", lineHeight: 1.6, color: "#A1A1A6" };
  const titleStyle: React.CSSProperties = { fontSize: "22px", fontWeight: 600, color: "#f5f5f7", margin: "0 0 16px" };

  const errorBox = error && (
    <div role="alert" style={{ background: "rgba(255,69,58,0.1)", border: "1px solid rgba(255,69,58,0.3)", borderRadius: "8px", padding: "12px", margin: "0 0 16px", color: "#FF453A", fontSize: "14px" }}>
      <p style={{ margin: 0 }}>{error}</p>
      {(errorCode === "active_bookings" || errorCode === "no_email" || errorCode === "email_failed") && (
        <a href={SITE_CONTACT.whatsappUrl} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", marginTop: "8px", color: "#25d366", fontWeight: 600 }} data-cms-key="deleteAccount.contact_support">
          {t("contact_support")}
        </a>
      )}
    </div>
  );

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}
      onClick={handleClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-account-title"
        style={{ position: "relative", background: "#1a1a1a", borderRadius: "16px", border: "1px solid rgba(255,255,255,0.1)", maxWidth: "480px", width: "90%", padding: "32px", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={handleClose} disabled={busy} aria-label={t("cancel")} style={{ position: "absolute", top: "12px", right: "12px", background: "transparent", border: "none", color: "#A1A1A6", cursor: busy ? "not-allowed" : "pointer", padding: "10px" }}>
          <X size={20} />
        </button>

        {step === "warn" && (
          <>
            <h2 id="delete-account-title" style={titleStyle} data-cms-key="deleteAccount.title">{t("title")}</h2>
            <div style={{ ...muted, marginBottom: "20px" }}>
              <p style={{ margin: "0 0 10px" }} data-cms-key="deleteAccount.intro">{t("intro")}</p>
              <ul style={{ listStyle: "disc", paddingLeft: "20px", margin: "0 0 12px" }}>
                {(["point_deactivate", "point_purge", "point_restore", "point_frozen", "point_history", "point_cancel"] as const).map((k) => (
                  <li key={k} data-cms-key={`deleteAccount.${k}`}>{t(k)}</li>
                ))}
              </ul>
              <p style={{ margin: 0, color: "#f5f5f7" }} data-cms-key="deleteAccount.active_note">{t("active_note")}</p>
            </div>
            {errorBox}
            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button onClick={handleClose} style={btn(false, false)} data-cms-key="deleteAccount.cancel">{t("cancel")}</button>
              <button onClick={() => sendCode("warn")} disabled={busy} style={btn(true, busy)} data-cms-key="deleteAccount.continue">{t("continue")}</button>
            </div>
          </>
        )}

        {step === "sending" && (
          <p style={{ ...muted, textAlign: "center", margin: "24px 0" }} role="status" data-cms-key="deleteAccount.sending">{t("sending")}</p>
        )}

        {step === "verify" && (
          <>
            <h2 id="delete-account-title" style={titleStyle} data-cms-key="deleteAccount.verify_title">{t("verify_title")}</h2>
            <p style={{ ...muted, margin: "0 0 16px" }}>{t("verify_sent", { email: maskedEmail })}</p>
            <label htmlFor="delete-account-code" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>{t("code_placeholder")}</label>
            <input
              id="delete-account-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              autoFocus
              value={code}
              placeholder={t("code_placeholder")}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              disabled={busy}
              style={{ width: "100%", minHeight: 52, padding: "0 16px", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.15)", background: "rgba(0,0,0,0.3)", color: "#fff", fontSize: "24px", letterSpacing: "8px", textAlign: "center", marginBottom: "12px", boxSizing: "border-box" }}
            />
            {errorBox}
            <button
              onClick={() => sendCode("verify")}
              disabled={busy || cooldown > 0}
              style={{ background: "transparent", border: "none", color: cooldown > 0 ? "#6b6b70" : "#A1A1A6", fontSize: "14px", padding: "8px 0", marginBottom: "16px", cursor: busy || cooldown > 0 ? "default" : "pointer", textDecoration: "underline" }}
            >
              {cooldown > 0 ? t("resend_in", { seconds: cooldown }) : t("resend")}
            </button>
            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button onClick={reset} disabled={busy} style={btn(false, busy)} data-cms-key="deleteAccount.back">{t("back")}</button>
              <button onClick={confirm} disabled={busy || code.length !== 6} style={btn(true, busy || code.length !== 6)} data-cms-key="deleteAccount.confirm">
                {busy ? t("processing") : t("confirm")}
              </button>
            </div>
          </>
        )}

        {step === "done" && (
          <>
            <h2 id="delete-account-title" style={titleStyle} data-cms-key="deleteAccount.done_title">{t("done_title")}</h2>
            <p style={{ ...muted, margin: "0 0 24px" }} role="status">{t("done_body", { date: purgeDate })}</p>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button onClick={handleClose} style={btn(false, false)} data-cms-key="deleteAccount.dismiss">{t("dismiss")}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
