import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import Nav from "@/components/layout/Nav";
import Footer from "@/components/layout/Footer";
import { getConfigValue } from "@/lib/data/getConfig";
import { getLegalSections } from "@/lib/data/getLegalData";
import LegalContent from "./LegalContent";

const BASE = "https://space8.com.hk";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal" });
  const path = locale === "zh-HK" ? "/legal" : `/${locale}/legal`;

  return {
    title: `${t("title")} | Space8`,
    description: t("subtitle"),
    alternates: {
      canonical: `${BASE}${path}`,
      languages: {
        "zh-HK": `${BASE}/legal`,
        "zh-CN": `${BASE}/zh-CN/legal`,
        en: `${BASE}/en/legal`,
      },
    },
    openGraph: {
      title: `${t("title")} | Space8`,
      description: t("subtitle"),
      url: `${BASE}${path}`,
      siteName: "Space8",
      type: "website",
    },
    robots: { index: true, follow: true },
  };
}

type TabId = "terms" | "privacy" | "refund" | "rules";

export default async function LegalPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { tab } = await searchParams;
  const valid: TabId[] = ["terms", "privacy", "refund", "rules"];
  const initialTab: TabId = valid.includes(tab as TabId) ? (tab as TabId) : "terms";

  // Last-updated date is editable from the config table (key: legal.updatedAt).
  const legalCfg = await getConfigValue<{ updatedAt?: string }>("legal", {});
  const lastUpdated = legalCfg.updatedAt ?? "2026-07-14";

  const t = await getTranslations({ locale, namespace: "legal" });
  const termsFallback = t.raw("terms_sections") as { title: string; body: string }[];
  const privacyFallback = t.raw("privacy_sections") as { title: string; body: string }[];
  const [termsSections, privacySections] = await Promise.all([
    getLegalSections("legal", "terms_sections", locale, termsFallback),
    getLegalSections("legal", "privacy_sections", locale, privacyFallback),
  ]);

  return (
    <main className="relative bg-white">
      <Nav />
      <LegalContent
        initialTab={initialTab}
        lastUpdated={lastUpdated}
        termsSections={termsSections}
        privacySections={privacySections}
      />
      <Footer />
    </main>
  );
}
