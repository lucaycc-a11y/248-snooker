import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMemberData } from "@/lib/data/getMember";
import { getConfig, getConfigValue } from "@/lib/data/getConfig";
import { resolveLocaleFromCookie, loadMessages } from "@/lib/i18n/serverLocale";
import MemberDashboard from "./MemberDashboard";

// Member dashboard is private — never index it.
export const metadata: Metadata = {
  title: "會員中心 | Space8",
  robots: { index: false, follow: false },
};

// Always render fresh per request (auth + personal data).
export const dynamic = "force-dynamic";

export default async function MemberPage() {
  // Protected route: fetch member data (returns null when not signed in).
  const data = await getMemberData();
  if (!data) redirect("/login?returnUrl=/member");

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
