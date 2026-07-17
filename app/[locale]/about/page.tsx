import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import Nav from "@/components/layout/Nav";
import Footer from "@/components/layout/Footer";
import WhatsAppButton from "@/components/shared/WhatsAppButton";
import { buildSportsClubJsonLd, safeJsonLd } from "@/lib/seo/jsonLd";
import AboutContent from "./AboutContent";

const BASE = "https://space8.com.hk";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const path = locale === "zh-HK" ? "/about" : `/${locale}/about`;

  const meta: Record<string, { title: string; description: string }> = {
    "zh-HK": {
      title: "關於我們｜SPACE8 無煙中八球室",
      description:
        "SPACE8 是香港新蒲崗的自助無煙中八獨立球室，全預約制，網上預訂、QR碼自助入場，全程不需人手協助。近鑽石山、啟德港鐵站。",
    },
    "zh-CN": {
      title: "关于我们｜SPACE8 无烟中式八球室",
      description:
        "SPACE8 是香港新蒲岗的自助无烟中式八球独立球室，全预约制，网上预订、QR码自助入场，全程不需人手协助。近钻石山、启德地铁站。",
    },
    en: {
      title: "About｜SPACE8 Smoke-Free Chinese Eight-Ball Club",
      description:
        "SPACE8 is a self-service, smoke-free Chinese eight-ball club in San Po Kong, Kowloon. Reservation-based — book online, self check-in via QR code, no staff required. Near MTR Diamond Hill and Kai Tak.",
    },
  };
  const m = meta[locale] ?? meta["zh-HK"];

  return {
    title: m.title,
    description: m.description,
    alternates: {
      canonical: `${BASE}${path}`,
      languages: {
        "zh-HK": `${BASE}/about`,
        "zh-CN": `${BASE}/zh-CN/about`,
        en: `${BASE}/en/about`,
        "x-default": `${BASE}/about`,
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

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // LocalBusiness (SportsClub) structured data — shared builder, was previously
  // a diverging inline copy (different priceRange/closes time from the homepage's).
  const jsonLd = buildSportsClubJsonLd(locale, "/about");

  return (
    <main className="relative bg-black">
      <Nav />
      <script type="application/ld+json">{safeJsonLd(jsonLd)}</script>
      <AboutContent />
      <Footer />
      <WhatsAppButton />
    </main>
  );
}
