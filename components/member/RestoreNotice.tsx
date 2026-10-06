"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

const SESSION_KEY = "s8_restore_notice_checked";

/**
 * Shows a one-time "welcome back" notice when the sign-in trigger has just
 * restored a soft-deleted account. Checked once per browser session.
 */
export default function RestoreNotice() {
  const t = useTranslations("deleteAccount");
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY)) return;
    sessionStorage.setItem(SESSION_KEY, "1");
    fetch("/api/member/delete-account/restore-notice", { method: "POST" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: unknown) => {
        if (typeof j === "object" && j !== null && (j as { restored?: unknown }).restored === true) setShow(true);
      })
      .catch(() => undefined);
  }, []);

  if (!show) return null;

  return (
    <div
      role="status"
      style={{ position: "fixed", left: "50%", bottom: "24px", transform: "translateX(-50%)", zIndex: 9998, width: "min(440px, calc(100% - 32px))", background: "#1a1a1a", border: "1px solid rgba(34,197,94,0.35)", borderRadius: "16px", padding: "20px", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}
    >
      <p style={{ margin: "0 0 6px", color: "#f5f5f7", fontSize: "16px", fontWeight: 600 }} data-cms-key="deleteAccount.restored_title">{t("restored_title")}</p>
      <p style={{ margin: "0 0 14px", color: "#A1A1A6", fontSize: "14px", lineHeight: 1.6 }} data-cms-key="deleteAccount.restored_body">{t("restored_body")}</p>
      <button
        onClick={() => setShow(false)}
        style={{ minHeight: 40, padding: "0 16px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.2)", background: "transparent", color: "#f5f5f7", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}
        data-cms-key="deleteAccount.dismiss"
      >
        {t("dismiss")}
      </button>
    </div>
  );
}
