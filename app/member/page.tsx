import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMemberData } from "@/lib/data/getMember";
import { getConfig } from "@/lib/data/getConfig";
import { resolveLocaleFromCookie, loadMessages } from "@/lib/i18n/serverLocale";
import MemberDashboard from "./MemberDashboard";

// Member dashboard is private — never index it.
export const metadata: Metadata = {
  title: "會員中心 | 248 Snooker",
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

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <MemberDashboard data={data} tiers={config.tiers} />
    </NextIntlClientProvider>
  );
}
