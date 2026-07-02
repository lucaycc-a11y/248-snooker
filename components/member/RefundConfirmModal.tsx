"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import type { MemberBooking } from "@/lib/data/getMember";

// Local palette copy — matches MemberDashboard.tsx's constants. Duplicated
// rather than imported since that file has no named exports besides the
// default component.
const DEEP = "#0a0a0a";
const INK = "#f5f5f7";
const SUBTLE = "#86868b";
const HAIRLINE = "rgba(255,255,255,0.18)";
const BORDER = "rgba(255,255,255,0.1)";
const GREEN = "#22C55E";
const DANGER = "#FF453A";
const FONT_FAMILY =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Helvetica, Arial, sans-serif";
const DISPLAY = '"Bebas Neue", sans-serif';
const SPRING = { type: "spring", stiffness: 320, damping: 30 } as const;

// Client-side estimate only, purely for display before the user confirms —
// the POST response carries the authoritative amount computed server-side by
// request_booking_refund().
function estimateRefund(price: number): { fee: number; amount: number } {
  const fee = Math.round(price * 0.034 + 2.35);
  return { fee, amount: Math.max(0, price - fee) };
}

export default function RefundConfirmModal({
  booking,
  onClose,
  onRefunded,
}: {
  booking: MemberBooking | null;
  onClose: () => void;
  onRefunded: (booking: MemberBooking, result: { refundAmount: number; refundFee: number }) => void;
}) {
  const t = useTranslations("memberPage");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    if (submitting) return;
    setReason("");
    setError(null);
    onClose();
  };

  const confirm = async () => {
    if (!booking) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${booking.id}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() || undefined }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          json.reason === "cutoff_closed"
            ? t("refund_modal_cutoff_error")
            : t("refund_modal_generic_error"),
        );
        return;
      }
      onRefunded(booking, { refundAmount: json.refundAmount, refundFee: json.refundFee });
      setReason("");
    } catch {
      setError(t("refund_modal_generic_error"));
    } finally {
      setSubmitting(false);
    }
  };

  const estimate = booking ? estimateRefund(booking.price) : null;

  return (
    <AnimatePresence>
      {booking && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={close}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            background: "rgba(0,0,0,0.8)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
          }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={SPRING}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "relative",
              width: "100%",
              maxWidth: "380px",
              background: DEEP,
              border: `1px solid ${HAIRLINE}`,
              borderRadius: "24px",
              padding: "32px",
              fontFamily: FONT_FAMILY,
            }}
          >
            <button
              type="button"
              onClick={close}
              aria-label={t("close")}
              style={{
                position: "absolute",
                top: "16px",
                right: "16px",
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                border: "none",
                background: "rgba(255,255,255,0.1)",
                color: INK,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X size={18} />
            </button>

            <h3
              style={{
                fontFamily: DISPLAY,
                fontSize: "22px",
                letterSpacing: "0.04em",
                margin: "0 0 24px",
                color: INK,
              }}
            >
              {t("refund_modal_title")}
            </h3>

            {estimate && (
              <div style={{ marginBottom: "20px" }}>
                <Row label={t("refund_modal_original_price")} value={`HK$${booking.price}`} />
                <Row label={t("refund_modal_fee")} value={`-HK$${estimate.fee}`} />
                <div style={{ height: "1px", background: BORDER, margin: "10px 0" }} />
                <Row
                  label={t("refund_modal_amount")}
                  value={`HK$${estimate.amount}`}
                  emphasize
                />
              </div>
            )}

            <label style={{ display: "block", marginBottom: "20px" }}>
              <span style={{ display: "block", fontSize: "13px", color: SUBTLE, marginBottom: "8px" }}>
                {t("refund_modal_reason_label")}
              </span>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                maxLength={500}
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  borderRadius: "12px",
                  border: `1px solid ${BORDER}`,
                  background: "rgba(0,0,0,0.25)",
                  color: INK,
                  fontSize: "14px",
                  fontFamily: FONT_FAMILY,
                  resize: "none",
                }}
              />
            </label>

            {error && (
              <p style={{ fontSize: "13px", color: DANGER, margin: "0 0 16px" }}>{error}</p>
            )}

            <div style={{ display: "flex", gap: "10px" }}>
              <button
                type="button"
                onClick={close}
                disabled={submitting}
                style={{
                  flex: 1,
                  minHeight: 48,
                  borderRadius: "12px",
                  border: `1px solid ${BORDER}`,
                  background: "transparent",
                  color: INK,
                  fontSize: "15px",
                  fontWeight: 600,
                  cursor: submitting ? "default" : "pointer",
                  fontFamily: FONT_FAMILY,
                }}
              >
                {t("refund_modal_cancel")}
              </button>
              <button
                type="button"
                onClick={confirm}
                disabled={submitting}
                style={{
                  flex: 1,
                  minHeight: 48,
                  borderRadius: "12px",
                  border: "none",
                  background: GREEN,
                  color: DEEP,
                  fontSize: "15px",
                  fontWeight: 700,
                  cursor: submitting ? "default" : "pointer",
                  opacity: submitting ? 0.6 : 1,
                  fontFamily: FONT_FAMILY,
                }}
              >
                {t("refund_modal_confirm")}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Row({ label, value, emphasize }: { label: string; value: string; emphasize?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
      <span style={{ fontSize: "14px", color: SUBTLE }}>{label}</span>
      <span
        style={{
          fontSize: emphasize ? "18px" : "14px",
          fontWeight: emphasize ? 700 : 500,
          color: emphasize ? GREEN : INK,
        }}
      >
        {value}
      </span>
    </div>
  );
}
