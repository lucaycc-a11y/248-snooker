import type { Metadata } from "next";
import { indexingMeta } from "@/lib/env/app-env";
import { pageAlternates } from "@/lib/seo/site";
import { setRequestLocale, getTranslations } from "next-intl/server";
import dynamic from "next/dynamic";
import Nav from "@/components/layout/Nav";
import Footer from "@/components/layout/Footer";
import { buildSportsClubJsonLd, safeJsonLd } from "@/lib/seo/jsonLd";
import { getConfig } from "@/lib/data";
import { getPublicPricingPeriods, lowestPublicRate } from "@/lib/seo/public-pricing";
import { periodsToSlots } from "@/lib/ui/pricing-adapter";
import PriceFaqBlock from "@/components/pricing/PriceFaqBlock";
import { Link } from "@/i18n/navigation";

// ── Heavy scroll animation components (lazy load) ───────────────────────────
const VenueContent = dynamic(
  () => import("./VenueContent"),
  { ssr: true }
);

const PricingCards = dynamic(
  () => import("@/components/ui/pricing-cards"),
  { ssr: true }
);

const WhatsAppButton = dynamic(
  () => import("@/components/shared/WhatsAppButton"),
  { ssr: false } // Client-only
);

const BASE = "https://space8.com.hk";

const META: Record<string, { title: string; description: string }> = {
  "zh-HK": {
    title: "場地介紹｜SPACE8 香港新蒲崗中八球室",
    description:
      "SPACE8 是香港新蒲崗自助無煙智能中式桌球球室，兩間1T獨立球室，每日 06:00 至 24:00 營業。網上預訂、二維碼自助入場。專業設備，智能系統，聚光在桌球本身。鄰近鑽石山和啟德地鐵站，方便停車。",
  },
  "zh-CN": {
    title: "场地介绍｜SPACE8 香港新蒲岗中式八球室",
    description:
      "SPACE8 场地设施及服务介绍：星牌中式八球台、专业级照明、智能 QR 门禁。全预约制，网上预订、QR码自助入场。地址：香港新蒲岗大有街 32 号泰力工业中心。",
  },
  en: {
    title: "Venue｜SPACE8 Chinese Eight-Ball Room in San Po Kong",
    description:
      "SPACE8 venue facilities and services: Star Chinese eight-ball table, tournament lighting, smart QR entry. Reservation-based — book online, self check-in via QR code. Laurels Industrial Centre, 32 Tai Yau Street, San Po Kong, Hong Kong.",
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const m = META[locale] ?? META["zh-HK"];
  const tSeo = await getTranslations({ locale, namespace: "seoPricing" });
  const minRate = lowestPublicRate(await getPublicPricingPeriods());
  const description = minRate != null ? `${m.description} ${tSeo("meta_from", { rate: String(minRate) })}` : m.description;
  const path = locale === "zh-HK" ? "/venue" : `/${locale}/venue`;
  const t = await getTranslations({ locale, namespace: "venuePage" });

  return {
    title: m.title,
    description,
    alternates: pageAlternates(locale, "/venue"),
    openGraph: {
      title: m.title,
      description,
      url: `${BASE}${path}`,
      siteName: "Space8",
      type: "website",
      images: [
        {
          url: `${BASE}/images/og-image-中八桌球-香港新蒲崗.png`,
          width: 1200,
          height: 630,
          alt: t('og_alt'),
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: m.title,
      description,
      images: [`${BASE}/images/og-image-中八桌球-香港新蒲崗.png`],
    },
    robots: indexingMeta(),
  };
}

export default async function VenuePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const config = await getConfig();
  const publicPeriods = await getPublicPricingPeriods();
  const tPricing = await getTranslations({ locale, namespace: "pricingPage" });
  const tCombo = await getTranslations({ locale, namespace: "combo" });
  const tSeo = await getTranslations({ locale, namespace: "seoPricing" });
  const slots = periodsToSlots(publicPeriods, (k, v) => tPricing(k, v), (k, v) => tCombo(k, v));
  const hasCombo = slots.some((s) => s.comboLabel != null);
  const jsonLd = buildSportsClubJsonLd(locale, "/venue", {
    periods: config.periods,
    openHour: config.openHour,
    closeHour: config.closeHour,
  });

  return (
    <main className="relative bg-black">
      <Nav />
      <script type="application/ld+json">{safeJsonLd(jsonLd)}</script>
      <VenueContent />
      <PricingCards
        theme="light"
        heading={hasCombo ? tCombo("title") : tPricing("periods_title")}
        subheading={hasCombo ? tCombo("note_tagline") : tPricing("periods_subtitle")}
        slots={slots}
        footnote={hasCombo ? tCombo("footnote") : undefined}
      />
      <div style={{ background: "#e8e8e8" }}>
        <PriceFaqBlock locale={locale} />
        <p style={{ maxWidth: 960, margin: "0 auto", padding: "0 20px 24px" }}>
          <Link href="/pricing" data-cms-key="seoPricing.see_pricing" style={{ color: "#16a34a", fontWeight: 600 }}>
            {tSeo("see_pricing")} →
          </Link>
        </p>
      </div>
      <Footer />
      <WhatsAppButton />
    </main>
  );
}
