import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import Nav from "@/components/layout/Nav";
import Footer from "@/components/layout/Footer";
import WhatsAppButton from "@/components/shared/WhatsAppButton";
import { getConfig } from "@/lib/data/getConfig";
import PricingContent from "./PricingContent";

const BASE = "https://248.formhk.com";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pricingPage" });
  const path = locale === "zh-HK" ? "/pricing" : `/${locale}/pricing`;

  const titles: Record<string, string> = {
    "zh-HK": "定價 | Space8 — 香港桌球 06:00-24:00營業",
    "zh-CN": "定价 | Space8 — 香港台球 06:00-24:00营业",
    en: "Pricing | Space8 — Snooker Hong Kong, Open Daily 06:00–24:00",
    ja: "料金 | Space8 — 香港スヌーカー 毎日06:00〜24:00営業",
  };

  return {
    title: titles[locale] ?? titles["zh-HK"],
    description: t("hero_subtitle"),
    alternates: {
      canonical: `${BASE}${path}`,
      languages: {
        "zh-HK": `${BASE}/pricing`,
        "zh-CN": `${BASE}/zh-CN/pricing`,
        en: `${BASE}/en/pricing`,
        ja: `${BASE}/ja/pricing`,
      },
    },
    openGraph: {
      title: titles[locale] ?? titles["zh-HK"],
      description: t("hero_subtitle"),
      url: `${BASE}${path}`,
      siteName: "Space8",
      type: "website",
    },
    robots: { index: true, follow: true },
  };
}

export default async function PricingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Prices come from Supabase config (with bundled fallback) — never hardcoded.
  const config = await getConfig();

  return (
    <main className="relative bg-black">
      <Nav />
      <PricingContent periods={config.periods} services={config.services} />
      <Footer />
      <WhatsAppButton />
    </main>
  );
}
