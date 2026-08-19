"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";

const GREEN = "#22C55E";
const DARK = "#1D1D1F";
const BORDER = "#2D2D2D";

const FONT_FAMILY =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Noto Sans TC', 'Helvetica Neue', Helvetica, Arial, sans-serif";

const SPRING = { type: "spring", stiffness: 320, damping: 30 } as const;

type QRGuideModalProps = {
  memberCode: string;
  onClose: () => void;
};

/* ── Icons ─────────────────────────────────────────────────────────────── */

function DoorIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
      <path d="M5 2h14a1 1 0 011 1v18a1 1 0 01-1 1H5a1 1 0 01-1-1V3a1 1 0 011-1z" />
      <path d="M12 15a2 2 0 100-4 2 2 0 000 4z" />
      <path d="M9 2v20" />
    </svg>
  );
}

function LockerIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18" />
      <path d="M9 21V9" />
      <path d="M12 12h4" />
      <path d="M12 15h4" />
    </svg>
  );
}

function PilotIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
      <path d="M12 2v4" />
      <path d="M12 18v4" />
      <path d="M4.93 4.93l2.83 2.83" />
      <path d="M16.24 16.24l2.83 2.83" />
      <path d="M2 12h4" />
      <path d="M18 12h4" />
    </svg>
  );
}

function RecordIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M8 13h3" />
      <path d="M16 13h-0.01" />
      <path d="M8 17h3" />
      <path d="M16 17h-0.01" />
    </svg>
  );
}

/* ── Main Component ────────────────────────────────────────────────────── */

export function QRGuideModal({ memberCode, onClose }: QRGuideModalProps) {
  const t = useTranslations("qrModal");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  // Fetch the QR code from the same API the member dashboard uses.
  // This ensures the QR is always generated from the current member_code,
  // not a cached value — satisfying the "synced with registration QR" requirement.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/member/qr");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data.qrCode) {
          setQrDataUrl(data.qrCode);
        }
      } catch {
        // Non-fatal — show placeholder if fetch fails
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const features = [
    { icon: <DoorIcon />, label: t("door") },
    { icon: <LockerIcon />, label: t("locker") },
    { icon: <PilotIcon />, label: t("pilot") },
    { icon: <RecordIcon />, label: t("record") },
  ];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 200,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          background: "rgba(0,0,0,0.7)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }}
      >
        <motion.div
          role="dialog"
          aria-modal="true"
          initial={{ scale: 0.92, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.92, opacity: 0, y: 20 }}
          transition={SPRING}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "relative",
            width: "100%",
            maxWidth: "400px",
            maxHeight: "90dvh",
            overflowY: "auto",
            background: DARK,
            border: `1px solid ${BORDER}`,
            borderRadius: "24px",
            padding: "36px 28px",
            color: "white",
            fontFamily: FONT_FAMILY,
            textAlign: "center",
          }}
        >
          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              position: "absolute",
              top: "16px",
              right: "16px",
              width: "32px",
              height: "32px",
              borderRadius: "50%",
              border: "none",
              background: "rgba(255,255,255,0.1)",
              color: "white",
              fontSize: "18px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 0,
            }}
          >
            ×
          </button>

          {/* Title */}
          <h2 style={{ fontSize: "24px", fontWeight: 700, letterSpacing: "-0.02em", margin: "0 0 6px" }}>
            {t("title")}
          </h2>
          <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.6)", margin: "0 0 28px" }}>
            {t("subtitle")}
          </p>

          {/* QR Code */}
          <div
            style={{
              width: "min(60vw, 200px)",
              height: "min(60vw, 200px)",
              margin: "0 auto 20px",
              background: "#fff",
              borderRadius: "16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="Member QR Code"
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
              />
            ) : (
              /* Placeholder while loading */
              <div style={{ color: "rgba(0,0,0,0.15)" }}>
                <svg viewBox="0 0 200 200" width="80%" height="80%">
                  <rect x="20" y="20" width="50" height="50" rx="4" stroke="currentColor" strokeWidth="3" fill="none" />
                  <rect x="130" y="20" width="50" height="50" rx="4" stroke="currentColor" strokeWidth="3" fill="none" />
                  <rect x="20" y="130" width="50" height="50" rx="4" stroke="currentColor" strokeWidth="3" fill="none" />
                  <rect x="30" y="30" width="30" height="30" rx="2" fill="currentColor" />
                  <rect x="140" y="30" width="30" height="30" rx="2" fill="currentColor" />
                  <rect x="30" y="140" width="30" height="30" rx="2" fill="currentColor" />
                </svg>
              </div>
            )}
          </div>

          {/* Member Code */}
          {memberCode && (
            <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.45)", margin: "0 0 24px", fontFamily: "monospace", letterSpacing: "0.05em" }}>
              {memberCode}
            </p>
          )}

          {/* Feature List */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "28px" }}>
            {features.map((f) => (
              <div
                key={f.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "10px 16px",
                  borderRadius: "12px",
                  background: "rgba(255,255,255,0.04)",
                  border: `1px solid ${BORDER}`,
                }}
              >
                <div style={{ color: GREEN, flexShrink: 0 }}>{f.icon}</div>
                <span style={{ fontSize: "14px", color: "rgba(255,255,255,0.8)" }}>{f.label}</span>
              </div>
            ))}
          </div>

          {/* Tip */}
          <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", margin: "0 0 24px" }}>
            {t("tip")}
          </p>

          {/* CTAs */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                width: "100%",
                height: "48px",
                borderRadius: "999px",
                border: "none",
                background: GREEN,
                color: "#000",
                fontSize: "15px",
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: FONT_FAMILY,
              }}
            >
              {t("cta_primary")}
            </button>
            <Link
              href="/member"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "48px",
                borderRadius: "999px",
                border: `1px solid ${BORDER}`,
                background: "transparent",
                color: "rgba(255,255,255,0.7)",
                fontSize: "15px",
                fontWeight: 500,
                textDecoration: "none",
                fontFamily: FONT_FAMILY,
              }}
            >
              {t("cta_secondary")}
            </Link>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ── Hook: usePostRegistrationQR ───────────────────────────────────────── */
// Wraps an onAuthComplete callback to show the QR modal after first registration.
// Detects "first time" by checking if the user had profile_complete=false before.

export function usePostRegistrationQR(originalOnComplete: () => void) {
  const [showQR, setShowQR] = useState(false);
  const [memberCode, setMemberCode] = useState("");

  const wrappedOnComplete = useCallback(
    (memberCodeFromProfile?: string) => {
      // If we got a memberCode from ProfileCompletion, this is a first-time registration.
      if (memberCodeFromProfile) {
        setMemberCode(memberCodeFromProfile);
        setShowQR(true);
        return;
      }
      // Otherwise, it's a returning user — go straight through.
      originalOnComplete();
    },
    [originalOnComplete],
  );

  const closeQR = useCallback(() => {
    setShowQR(false);
    originalOnComplete();
  }, [originalOnComplete]);

  return { wrappedOnComplete, showQR, memberCode, closeQR };
}
