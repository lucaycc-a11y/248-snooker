import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import Nav from "@/components/layout/Nav";
import Footer from "@/components/layout/Footer";
import { getConfigValue } from "@/lib/data/getConfig";
import LegalContent from "./LegalContent";

const BASE = "https://248.formhk.com";

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
        ja: `${BASE}/ja/legal`,
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
  const lastUpdated = legalCfg.updatedAt ?? "2026-06-29";

  return (
    <main className="relative bg-white">
      <Nav />
      <LegalContent initialTab={initialTab} lastUpdated={lastUpdated} />
      <Footer />
    </main>
  );
}
