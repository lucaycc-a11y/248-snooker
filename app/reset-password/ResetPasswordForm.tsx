"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Logo } from "@/components/brand";
import { PasswordInput } from "@/components/shared/PasswordInput";
import PasswordStrength from "@/components/auth/PasswordStrength";
import { validatePassword } from "@/lib/auth/password";
import { requestResetByEmail, submitNewPassword } from "./actions";

// Tokens mirror AuthCard so this page reads as part of the login flow.
const GREEN = "#22c55e";
const EASE = [0.16, 1, 0.3, 1] as const;
const INPUT_STYLE = {
  height: 52,
  background: "rgba(255,255,255,0.04)",
  borderRadius: 12,
  padding: "0 16px",
  color: "#fff",
  fontSize: 16,
  outline: "none",
} as const;
const TOKEN_RE = /^[A-Za-z0-9_-]{16,128}$/;

type Mode = "loading" | "request" | "sent" | "form" | "invalid";

function inputStyle(hasError: boolean) {
  return { ...INPUT_STYLE, width: "100%", border: `1px solid ${hasError ? "#f87171" : "rgba(255,255,255,0.14)"}` };
}

function primaryButton(busy: boolean) {
  return {
    width: "100%",
    minHeight: 52,
    border: "none",
    borderRadius: 9999,
    background: busy ? "rgba(34,197,94,0.5)" : GREEN,
    color: "#000",
    fontWeight: 700,
    fontSize: 16,
    cursor: busy ? "not-allowed" : "pointer",
  } as const;
}

const LINK_BUTTON = {
  minHeight: 44,
  background: "none",
  border: "none",
  color: "rgba(255,255,255,0.6)",
  fontSize: 14,
  cursor: "pointer",
  textAlign: "center",
} as const;

export default function ResetPasswordForm() {
  const t = useTranslations("resetPassword");
  const tAuth = useTranslations("auth");

  // The token lives only in this ref after mount — never in state that
  // re-renders into the DOM, never in the visible URL.
  const tokenRef = useRef<string | null>(null);
  const inFlight = useRef(false);

  const [mode, setMode] = useState<Mode>("loading");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  // Idempotent: the URL is stripped on the first read, so any re-run (React
  // Strict Mode double-invokes effects) must reuse the first result.
  const initialMode = useRef<Mode | null>(null);

  useEffect(() => {
    if (initialMode.current === null) {
      const url = new URL(window.location.href);
      const tokenHash = url.searchParams.get("token_hash");
      const type = url.searchParams.get("type");

      if (tokenHash || type) {
        // Strip the token from the address bar and history immediately.
        window.history.replaceState(null, "", url.pathname);
      }

      if (tokenHash && type === "recovery" && TOKEN_RE.test(tokenHash)) {
        tokenRef.current = tokenHash;
        initialMode.current = "form";
      } else {
        initialMode.current = tokenHash || type ? "invalid" : "request";
      }
    }
    setMode(initialMode.current);
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(id);
  }, [cooldown]);

  const onRequest = async (e: FormEvent) => {
    e.preventDefault();
    if (inFlight.current || cooldown > 0) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError(t("err_email"));
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await requestResetByEmail(email);
      if (result.ok) {
        setMode("sent");
        setCooldown(60);
      } else if (result.error === "invalid_email") {
        setError(t("err_email"));
      } else if (result.error === "cooldown") {
        setError(t("err_cooldown"));
        setCooldown(60);
      } else if (result.error === "rate_limited") {
        setError(t("err_rate_limited"));
      } else {
        setError(t("err_send"));
      }
    } catch {
      setError(t("err_send"));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    // Double-click / double-submit guard: the token is single-use.
    if (inFlight.current) return;
    const token = tokenRef.current;
    if (!token) {
      setMode("invalid");
      return;
    }
    if (password !== confirm) {
      setError(t("err_mismatch"));
      return;
    }
    if (!validatePassword(password).ok) {
      setError(tAuth("err_password_weak"));
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await submitNewPassword({ tokenHash: token, password, confirm });
      if (result.ok) {
        tokenRef.current = null;
        setPassword("");
        setConfirm("");
        window.location.replace("/login?reset=success");
        return;
      }
      if (result.error === "link_invalid") {
        tokenRef.current = null;
        setMode("invalid");
      } else if (result.error === "password_weak") {
        setError(tAuth("err_password_weak"));
      } else if (result.error === "password_mismatch") {
        setError(t("err_mismatch"));
      } else if (result.error === "rate_limited") {
        setError(t("err_rate_limited"));
      } else {
        setError(t("err_update"));
      }
    } catch {
      setError(t("err_update"));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const toRequest = () => {
    setError(null);
    setPassword("");
    setConfirm("");
    setMode("request");
  };

  return (
    <section className="glass-panel" style={{ width: "100%", maxWidth: 400, padding: 40 }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
        <Logo variant="full" theme="dark" size={40} />
      </div>

      {mode === "loading" && <div style={{ height: 120 }} aria-busy="true" />}

      {mode === "request" && (
        <motion.form onSubmit={onRequest} noValidate initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.35, ease: EASE }}>
          <h1 data-cms-key="resetPassword.request_title" style={{ fontFamily: '"Bebas Neue", sans-serif', fontSize: 30, color: "#fff", margin: "0 0 6px", textAlign: "center" }}>
            {t("request_title")}
          </h1>
          <p data-cms-key="resetPassword.request_body" style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", textAlign: "center", margin: "0 0 20px", lineHeight: 1.5 }}>
            {t("request_body")}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder={tAuth("email_placeholder")}
              aria-label={tAuth("email_placeholder")}
              aria-invalid={Boolean(error)}
              style={inputStyle(Boolean(error))}
            />
            <button type="submit" disabled={busy || cooldown > 0} data-cms-key="resetPassword.request_submit" style={primaryButton(busy || cooldown > 0)}>
              {busy ? tAuth("sending") : cooldown > 0 ? t("resend_in", { seconds: cooldown }) : t("request_submit")}
            </button>
            {error !== null && <p role="alert" data-cms-key="resetPassword.error" style={{ fontSize: 13, color: "#f87171", textAlign: "center", margin: 0 }}>{error}</p>}
            <a href="/login" data-cms-key="resetPassword.back_to_login" style={{ ...LINK_BUTTON, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>
              {t("back_to_login")}
            </a>
          </div>
        </motion.form>
      )}

      {mode === "sent" && (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.35, ease: EASE }} style={{ textAlign: "center" }}>
          <h1 data-cms-key="resetPassword.sent_title" style={{ fontFamily: '"Bebas Neue", sans-serif', fontSize: 30, color: "#fff", margin: "0 0 10px" }}>
            {t("sent_title")}
          </h1>
          <p role="status" data-cms-key="resetPassword.sent_body" style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", margin: "0 0 24px", lineHeight: 1.6 }}>
            {t("sent_body")}
          </p>
          <button type="button" onClick={toRequest} disabled={cooldown > 0} data-cms-key="resetPassword.resend" style={{ ...LINK_BUTTON, width: "100%", color: cooldown > 0 ? "rgba(255,255,255,0.35)" : GREEN, cursor: cooldown > 0 ? "default" : "pointer" }}>
            {cooldown > 0 ? t("resend_in", { seconds: cooldown }) : t("resend")}
          </button>
          <a href="/login" data-cms-key="resetPassword.back_to_login" style={{ ...LINK_BUTTON, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>
            {t("back_to_login")}
          </a>
        </motion.div>
      )}

      {mode === "form" && (
        <motion.form onSubmit={onSubmit} noValidate initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.35, ease: EASE }}>
          {/* Hidden username field so password managers file the new password correctly. */}
          <input type="text" name="username" autoComplete="username" hidden readOnly />
          <h1 data-cms-key="resetPassword.form_title" style={{ fontFamily: '"Bebas Neue", sans-serif', fontSize: 30, color: "#fff", margin: "0 0 6px", textAlign: "center" }}>
            {t("form_title")}
          </h1>
          <p data-cms-key="resetPassword.form_body" style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", textAlign: "center", margin: "0 0 20px" }}>
            {t("form_body")}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <PasswordInput
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              placeholder={t("new_password")}
              aria-label={t("new_password")}
              showLabel={t("show_password")}
              hideLabel={t("hide_password")}
              style={inputStyle(Boolean(error))}
            />
            <PasswordStrength value={password} />
            <PasswordInput
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              placeholder={t("confirm_password")}
              aria-label={t("confirm_password")}
              showLabel={t("show_password")}
              hideLabel={t("hide_password")}
              style={inputStyle(Boolean(error))}
            />
            <button type="submit" disabled={busy} data-cms-key="resetPassword.form_submit" style={primaryButton(busy)}>
              {busy ? t("saving") : t("form_submit")}
            </button>
            {error !== null && <p role="alert" data-cms-key="resetPassword.error" style={{ fontSize: 13, color: "#f87171", textAlign: "center", margin: 0 }}>{error}</p>}
          </div>
        </motion.form>
      )}

      {mode === "invalid" && (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.35, ease: EASE }} style={{ textAlign: "center" }}>
          <h1 data-cms-key="resetPassword.invalid_title" style={{ fontFamily: '"Bebas Neue", sans-serif', fontSize: 30, color: "#fff", margin: "0 0 10px" }}>
            {t("invalid_title")}
          </h1>
          <p data-cms-key="resetPassword.invalid_body" style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", margin: "0 0 24px", lineHeight: 1.6 }}>
            {t("invalid_body")}
          </p>
          <button type="button" onClick={toRequest} data-cms-key="resetPassword.resend_link" style={primaryButton(false)}>
            {t("resend_link")}
          </button>
          <a href="/login" data-cms-key="resetPassword.back_to_login" style={{ ...LINK_BUTTON, marginTop: 8, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>
            {t("back_to_login")}
          </a>
        </motion.div>
      )}
    </section>
  );
}
