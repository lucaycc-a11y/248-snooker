"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";

/** Shown to email-only accounts (joined via Space Pilot QR): booking needs a phone verified by OTP. */
export default function PhoneRequiredBanner() {
  const t = useTranslations("memberPhoneBanner");
  const [show, setShow] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const supabase = createClient();
        const { data: auth } = await supabase.auth.getUser();
        if (!auth.user) return;
        const { data } = await supabase
          .from("users")
          .select("onboarding_status, profile_complete")
          .eq("id", auth.user.id)
          .maybeSingle<{ onboarding_status: string | null; profile_complete: boolean | null }>();
        if (alive && data?.onboarding_status === "email_only" && data.profile_complete !== true) setShow(true);
      } catch {
        /* banner is optional */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (!show) return null;
  return (
    <div
      role="status"
      style={{ margin: "12px auto", maxWidth: 720, padding: "12px 16px", borderRadius: 14, background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.35)", color: "#fff", display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}
    >
      <span data-cms-key="memberPhoneBanner.text" style={{ fontSize: 14 }}>{t("text")}</span>
      <a
        href="/login?returnUrl=%2Fbook"
        data-cms-key="memberPhoneBanner.cta"
        style={{ minHeight: 40, padding: "0 16px", borderRadius: 999, background: "#22C55E", color: "#04130A", fontWeight: 600, fontSize: 14, display: "inline-flex", alignItems: "center", textDecoration: "none" }}
      >
        {t("cta")}
      </a>
    </div>
  );
}
