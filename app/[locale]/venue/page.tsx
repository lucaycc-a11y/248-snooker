import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import Nav from "@/components/layout/Nav";
import Footer from "@/components/layout/Footer";
import WhatsAppButton from "@/components/shared/WhatsAppButton";
import { buildSportsClubJsonLd, safeJsonLd } from "@/lib/seo/jsonLd";
import VenueContent from "./VenueContent";

const BASE = "https://space8.com.hk";

const META: Record<string, { title: string; description: string }> = {
  "zh-HK": {
    title: "場地介紹｜SPACE8 新蒲崗中八球室",
    description:
      "SPACE8 場地設施及服務介紹：星牌中八球枱、專業級照明、智能 QR 門禁。全預約制，網上預訂、QR碼自助入場。地址：香港新蒲崗大有街 32 號泰力工業中心 3 樓 05 室。",
  },
  "zh-CN": {
    title: "场地介绍｜SPACE8 新蒲岗中式八球室",
    description:
      "SPACE8 场地设施及服务介绍：星牌中式八球台、专业级照明、智能 QR 门禁。全预约制，网上预订、QR码自助入场。地址：香港新蒲岗大有街 32 号泰力工业中心 3 楼 05 室。",
  },
  en: {
    title: "Venue｜SPACE8 Chinese Eight-Ball Room in San Po Kong",
    description:
      "SPACE8 venue facilities and services: Star Chinese eight-ball table, tournament lighting, smart QR entry. Reservation-based — book online, self check-in via QR code. Room 05, 3/F, Tai Lik Industrial Centre, 32 Tai Yau Street, San Po Kong, Hong Kong.",
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

  return {
    title: m.title,
    description: m.description,
    alternates: {
      canonical: `${BASE}${path}`,
      languages: {
        "zh-HK": `${BASE}/venue`,
        "zh-CN": `${BASE}/zh-CN/venue`,
        en: `${BASE}/en/venue`,
        "x-default": `${BASE}/venue`,
      },
    },
    openGraph: {
      title: m.title,
      description: m.description,
      url: `${BASE}${path}`,
      siteName: "Space8",
      type: "website",
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

  const jsonLd = buildSportsClubJsonLd(locale, "/venue");

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
