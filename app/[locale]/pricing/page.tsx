import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import Nav from "@/components/layout/Nav";
import Footer from "@/components/layout/Footer";
import WhatsAppButton from "@/components/shared/WhatsAppButton";
import { getConfig } from "@/lib/data/getConfig";
import { buildPricingOffersJsonLd, safeJsonLd } from "@/lib/seo/jsonLd";
import PricingContent from "./PricingContent";

const BASE = "https://space8.com.hk";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pricingPage" });
  const path = locale === "zh-HK" ? "/pricing" : `/${locale}/pricing`;

  const titles: Record<string, string> = {
    "zh-HK": "定價｜SPACE8 新蒲崗自助中式桌球室收費表",
    "zh-CN": "定价｜SPACE8 新蒲岗自助中式台球室收费表",
    en: "Pricing｜SPACE8 Self-Service Chinese Pool, San Po Kong",
  };

  // Keyword-rich description built from the SAME config the page renders — never
  // hardcode prices (project rule). Lists each period's per-hour rate so the
  // snippet itself answers "how much?" for search/AI results.
  const config = await getConfig();
  const rateList = config.periods
    .map((p) => `${t(`period_${p.id}_title`)} HK$${p.rate}/h`)
    .join("、");
  const descByLocale: Record<string, string> = {
    "zh-HK": `SPACE8 新蒲崗自助中式桌球室收費表：${rateList}。連訂 2 小時或以上享折扣。網上預訂、QR 碼自助入場，每日 06:00–24:00 營業。`,
    "zh-CN": `SPACE8 新蒲岗自助中式台球室收费表：${rateList}。连订 2 小时或以上享折扣。网上预订、二维码自助入场，每日 06:00–24:00 营业。`,
    en: `SPACE8 self-service Chinese pool rates in San Po Kong: ${rateList}. Discounts for 2+ hour bookings. Book online, enter by QR code, open daily 06:00–24:00.`,
  };
  const description = descByLocale[locale] ?? descByLocale["zh-HK"];

  return {
    title: titles[locale] ?? titles["zh-HK"],
    description,
    alternates: {
      canonical: `${BASE}${path}`,
      languages: {
        "zh-HK": `${BASE}/pricing`,
        "zh-CN": `${BASE}/zh-CN/pricing`,
        en: `${BASE}/en/pricing`,
        "x-default": `${BASE}/pricing`,
      },
    },
    openGraph: {
      title: titles[locale] ?? titles["zh-HK"],
      description,
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

  // Offer structured data built from the SAME config the cards render from, so
  // schema and UI can never drift. Localised names/descriptions via next-intl.
  const t = await getTranslations({ locale, namespace: "pricingPage" });
  const offersJsonLd = buildPricingOffersJsonLd(config.periods, {
    name: (id) => t(`period_${id}_title`),
    description: (p) => {
      const time = t(`period_${p.id}_time`);
      if (p.rateFrom2h !== undefined) {
        return `${time}，每小時 HK$${p.rate}，${t("member_price_prefix")}每小時 HK$${p.rateFrom2h}。`;
      }
      return `${time}，每小時 HK$${p.rate}。`;
    },
  });

  return (
    <main className="relative bg-black">
      <Nav />
      <script type="application/ld+json">{safeJsonLd(offersJsonLd)}</script>
      <PricingContent periods={config.periods} services={config.services} />
      <Footer />
      <WhatsAppButton />
    </main>
  );
}
