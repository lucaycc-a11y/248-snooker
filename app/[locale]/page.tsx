import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import Nav from "@/components/layout/Nav";
import Hero from "@/components/landing/Hero";
import GalleryScroll from "@/components/landing/GalleryScroll";
import HowItWorks from "@/components/landing/HowItWorks";
import HomePricing from "@/components/landing/HomePricing";
import { getConfig } from "@/lib/data/getConfig";
import Member from "@/components/landing/Member";
import HomeFAQ from "@/components/landing/HomeFAQ";
import Directions from "@/components/landing/Directions";
import Footer from "@/components/layout/Footer";
import ContactButton from "@/components/shared/ContactButton";
import { AmbientGlow } from "@/components/shared/AmbientGlow";
import SpacePilotSection from "@/components/landing/SpacePilotSection";
import { getFaqJsonLd, HOMEPAGE_FAQ_IDS } from "@/components/landing/faqData";
import { buildSportsClubJsonLd, safeJsonLd } from "@/lib/seo/jsonLd";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;

  const meta: Record<string, { title: string; description: string; keywords: string[]; ogTitle: string; ogDesc: string; canonical: string; ogLocale: string }> = {
    'zh-HK': {
      title: 'SPACE8｜香港中八桌球室｜新蒲崗自助無煙獨立球室',
      description: 'SPACE8 是香港新蒲崗自助無煙中八獨立球室，全預約制，網上預訂、QR碼自助入場。鄰近鑽石山及啟德港鐵站，九龍區中八愛好者主場。',
      keywords: ['中八', '中式八球', '中式桌球', '香港中八', '新蒲崗桌球', '鑽石山桌球', '九龍桌球', '自助桌球', '無煙桌球室'],
      ogTitle: 'SPACE8',
      ogDesc: '香港中八桌球室 · 新蒲崗自助無煙獨立球室 · 全預約制',
      canonical: 'https://space8.com.hk',
      ogLocale: 'zh_HK',
    },
    'zh-CN': {
      title: 'SPACE8｜香港中式八球台球室｜新蒲岗自助无烟独立球室',
      description: 'SPACE8 是香港新蒲岗自助无烟中式八球独立球室，全预约制，网上预订、QR码自助入场。邻近钻石山及启德港铁站，九龙区中式八球爱好者主场。',
      keywords: ['中式八球', '中八', '中式台球', '香港中式八球', '新蒲岗台球', '钻石山台球', '九龙台球', '自助台球', '无烟台球室'],
      ogTitle: 'SPACE8',
      ogDesc: '香港中式八球台球室 · 新蒲岗自助无烟独立球室 · 全预约制',
      canonical: 'https://space8.com.hk/zh-CN',
      ogLocale: 'zh_CN',
    },
    en: {
      title: 'SPACE8｜Hong Kong Chinese Eight-Ball Club｜Self-Service Private Rooms in San Po Kong',
      description: 'SPACE8 is a self-service, smoke-free Chinese eight-ball club in San Po Kong, Hong Kong. Reservation-based, book online with QR code check-in. Near Diamond Hill and Kai Tak MTR stations.',
      keywords: ['Chinese eight-ball', 'Chinese 8-ball pool', 'Chinese eight-ball Hong Kong', 'San Po Kong pool', 'Kowloon pool', 'self service pool', 'smoke-free pool room'],
      ogTitle: 'SPACE8',
      ogDesc: 'Hong Kong Chinese Eight-Ball Club · San Po Kong · Reservation-Based',
      canonical: 'https://space8.com.hk/en',
      ogLocale: 'en_HK',
    },
  }

  const m = meta[locale] ?? meta['zh-HK']

  return {
    title: m.title,
    description: m.description,
    keywords: m.keywords,
    openGraph: {
      title: m.ogTitle,
      description: m.ogDesc,
      url: m.canonical,
      siteName: 'Space8',
      locale: m.ogLocale,
      type: 'website',
      images: [
        {
          url: 'https://space8.com.hk/og-image.png',
          width: 1200,
          height: 630,
          alt: 'SPACE8 Club Hong Kong',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Space8',
      description: m.ogDesc,
      images: ['https://space8.com.hk/og-image.png'],
    },
    alternates: {
      canonical: m.canonical,
      languages: {
        'zh-HK': 'https://space8.com.hk',
        'zh-CN': 'https://space8.com.hk/zh-CN',
        en: 'https://space8.com.hk/en',
        'x-default': 'https://space8.com.hk',
      },
    },
    robots: { index: true, follow: true },
  };
}

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const sportsClubJsonLd = buildSportsClubJsonLd(locale, locale === "zh-HK" ? "/" : `/${locale}`);
  const config = await getConfig();

  return (
    <main className="relative bg-black" style={{ isolation: "isolate" }}>
      <script type="application/ld+json">{safeJsonLd(sportsClubJsonLd)}</script>
      <AmbientGlow />
      <Nav />
      <Hero />
      <GalleryScroll />
      <HowItWorks />
      <HomePricing periods={config.periods} />

      {/* Learn More scroll target — zero-height anchor, sections flow directly */}
      <div id="social-proof" aria-hidden="true" />

      {/* Membership — last section before footer */}
      <Member />
      <SpacePilotSection />

      {/* FAQ — above the footer. Homepage shows a curated 5-item subset with
          a "了解更多" link to the full /faq page. */}
      <HomeFAQ ids={HOMEPAGE_FAQ_IDS} moreHref="/faq" />

      <Directions />

      <Footer />

      {/* Floating contact CTA — mobile only. AI chat by default; becomes an
          AI-edit entry point when an admin has edit-mode on. */}
      <ContactButton />
    </main>
  );
}
