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
    title: "場地 | Space8 — 自助中式桌球獨立球室",
    description:
      "Space8 場地設施及服務介紹：星牌中式桌球枱、專業級照明、智能 QR 門禁。地址：香港新蒲崗大有街 32 號泰力工業中心 3 樓 05 室。",
  },
  "zh-CN": {
    title: "场地 | Space8 — 自助中式桌球独立球室",
    description:
      "Space8 场地设施及服务介绍：星牌中式桌球台、专业级照明、智能 QR 门禁。地址：香港新蒲岗大有街 32 号泰力工业中心 3 楼 05 室。",
  },
  en: {
    title: "Venue | Space8 — Private Self-Service Chinese Pool Room",
    description:
      "Space8 venue facilities and services: Star Chinese pool table, tournament lighting, smart QR entry. Room 05, 3/F, Tai Lik Industrial Centre, 32 Tai Yau Street, San Po Kong, Hong Kong.",
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
