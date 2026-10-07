import type { Metadata } from "next";
import { pageAlternates } from "@/lib/seo/site";
import { setRequestLocale, getTranslations } from "next-intl/server";
import dynamic from "next/dynamic";
import Nav from "@/components/layout/Nav";
import Footer from "@/components/layout/Footer";
import { buildSportsClubJsonLd, safeJsonLd } from "@/lib/seo/jsonLd";
import { getConfig } from "@/lib/data";

// ── Heavy scroll animation components (lazy load) ───────────────────────────
const VenueContent = dynamic(
  () => import("./VenueContent"),
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
      "SPACE8 場地設施及服務介紹：星牌中八球枱、專業級照明、智能 QR 門禁。全預約制，網上預訂、QR碼自助入場。地址：香港新蒲崗大有街 32 號泰力工業中心 3 樓 05 室。",
  },
  "zh-CN": {
    title: "场地介绍｜SPACE8 香港新蒲岗中式八球室",
    description:
      "SPACE8 场地设施及服务介绍：星牌中式八球台、专业级照明、智能 QR 门禁。全预约制，网上预订、QR码自助入场。地址：香港新蒲岗大有街 32 号泰力工业中心 3 楼 05 室。",
  },
  en: {
    title: "Venue｜SPACE8 Chinese Eight-Ball Room in San Po Kong",
    description:
      "SPACE8 venue facilities and services: Star Chinese eight-ball table, tournament lighting, smart QR entry. Reservation-based — book online, self check-in via QR code. Room 05, 3/f, Laurels Industrial Centre, Tai Yau Street 32, San Po Kong, Hong Kong.",
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const m = META[locale] ?? META["zh-HK"];
  const path = locale === "zh-HK" ? "/venue" : `/${locale}/venue`;
  const t = await getTranslations({ locale, namespace: "venuePage" });

  return {
    title: m.title,
    description: m.description,
    alternates: pageAlternates(locale, "/venue"),
    openGraph: {
      title: m.title,
      description: m.description,
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
      description: m.description,
      images: [`${BASE}/images/og-image-中八桌球-香港新蒲崗.png`],
    },
    robots: { index: true, follow: true },
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
  const jsonLd = buildSportsClubJsonLd(locale, "/venue", config.periods);

  return (
    <main className="relative bg-black">
      <Nav />
      <script type="application/ld+json">{safeJsonLd(jsonLd)}</script>
      <VenueContent />
      <Footer />
      <WhatsAppButton />
    </main>
  );
}
