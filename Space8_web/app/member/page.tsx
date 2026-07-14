import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMemberData } from "@/lib/data/getMember";
import { getConfig, getConfigValue } from "@/lib/data/getConfig";
import { resolveLocaleFromCookie, loadMessages } from "@/lib/i18n/serverLocale";
import MemberDashboard from "./MemberDashboard";
import MemberPublic from "./MemberPublic";

// /member is publicly browsable (tier info + how membership works) even when
// signed out — only index the public view, not the private dashboard state.
export const metadata: Metadata = {
  title: "會員 | Space8",
  robots: { index: true, follow: true },
};

// Always render fresh per request (auth + personal data).
export const dynamic = "force-dynamic";

export default async function MemberPage() {
  // Publicly browsable (item 七): no session → show the public tier-info +
  // 玩法介紹 view instead of redirecting to /login.
  const data = await getMemberData();
  if (!data) {
    const locale = await resolveLocaleFromCookie();
    const messages = await loadMessages(locale);
    return (
      <NextIntlClientProvider locale={locale} messages={messages}>
        <MemberPublic />
      </NextIntlClientProvider>
    );
  }

  // Profile completion gate: if profile is incomplete, redirect to /login where
  // AuthCard will detect the session and show the profile completion flow (which
  // includes the planet reveal animation for new members).
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("users")
    .select("profile_complete")
    .eq("id", data.user.id)
    .maybeSingle();

  if (profile?.profile_complete !== true) {
    redirect("/login?returnUrl=/member");
  }

  // /member lives outside the [locale] segment (bypassed by middleware), so we
  // resolve the locale from the NEXT_LOCALE cookie and provide messages here.
  const locale = await resolveLocaleFromCookie();
  const messages = await loadMessages(locale);

  // Tier thresholds come from config (with bundled fallback).
  const config = await getConfig();

  // Refund cutoff window (hours before start_time inside which self-serve
  // refund is blocked) — soft client-side gate only; request_booking_refund()
  // is the authority.
  const bookingRules = await getConfigValue("booking_rules", { refundCutoffHours: 1 });

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <MemberDashboard data={data} tiers={config.tiers} refundCutoffHours={bookingRules.refundCutoffHours} />
    </NextIntlClientProvider>
  );
}
