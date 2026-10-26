import type { Metadata } from "next";
import { pageAlternates } from "@/lib/seo/site";
import { indexingMeta } from "@/lib/env/app-env";
import { getLegalDocument } from "@/content/legal";
import type { Locale } from "@/i18n/routing";
import LegalPage from "../legal/page";

const BASE = "https://space8.com.hk";

// /privacy is a real, crawlable page that renders the privacy policy itself
// (no redirect, no tab to click). This is the URL registered with Google
// Cloud OAuth branding and linked from the footer, so it must show the policy
// text directly.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const doc = getLegalDocument("privacy", locale as Locale);
  const intro = doc.intro ?? "";
  const description = intro.length > 155 ? `${intro.slice(0, 155)}…` : intro;
  const path = locale === "zh-HK" ? "/privacy" : `/${locale}/privacy`;
  return {
    title: `${doc.title} | Space8`,
    description,
    alternates: pageAlternates(locale, "/privacy"),
    openGraph: {
      title: `${doc.title} | Space8`,
      description,
      url: `${BASE}${path}`,
      siteName: "Space8",
      type: "website",
    },
    robots: indexingMeta(),
  };
}

export default function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  return LegalPage({ params, searchParams: Promise.resolve({ doc: "privacy" }) });
}
