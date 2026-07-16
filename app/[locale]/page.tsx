import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import Nav from "@/components/layout/Nav";
import Hero from "@/components/landing/Hero";
import Gallery from "@/components/landing/Gallery";
import HowItWorks from "@/components/landing/HowItWorks";
import PeriodPricingSections from "@/components/pricing/PeriodPricingSections";
import { getConfig } from "@/lib/data/getConfig";
import Member from "@/components/landing/Member";
import FAQ from "@/components/landing/FAQ";
import Footer from "@/components/layout/Footer";
import ContactButton from "@/components/shared/ContactButton";
import { AmbientGlow } from "@/components/shared/AmbientGlow";
import { getFaqJsonLd } from "@/components/landing/faqData";
import { buildSportsClubJsonLd, safeJsonLd } from "@/lib/seo/jsonLd";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;

  const meta: Record<string, { title: string; description: string; keywords: string[]; ogTitle: string; ogDesc: string; canonical: string; ogLocale: string }> = {
    'zh-HK': {
      title: 'SPACE8｜香港新蒲崗自助無煙中式桌球室 06:00-24:00營業',
      description: '香港新蒲崗自助無煙中式桌球獨立球室，每日06:00至24:00營業。網上預訂、QR碼自助入場，即時確認、Apple Pay付款。近鑽石山、啟德港鐵站，九龍區桌球愛好者主場。',
      keywords: ['中式桌球', '中八', '桌球', '香港桌球', '新蒲崗桌球', '鑽石山桌球', '九龍桌球', '自助桌球', '無煙桌球室'],
      ogTitle: 'SPACE8',
      ogDesc: '香港新蒲崗自助無煙中式桌球室 · 每日06:00-24:00營業',
      canonical: 'https://space8.com.hk',
      ogLocale: 'zh_HK',
    },
    'zh-CN': {
      title: 'SPACE8｜香港新蒲岗自助无烟中式台球室 06:00-24:00营业',
      description: '香港新蒲岗自助无烟中式台球独立球室，每日06:00至24:00营业。网上预订、二维码自助入场，即时确认、Apple Pay付款。近钻石山、启德地铁站，九龙区台球爱好者主场。',
      keywords: ['中式台球', '中八', '台球', '香港台球', '新蒲岗台球', '钻石山台球', '九龙台球', '自助台球', '无烟台球室'],
      ogTitle: 'SPACE8',
      ogDesc: '香港新蒲岗自助无烟中式台球室 · 每日06:00-24:00营业',
      canonical: 'https://space8.com.hk/zh-CN',
      ogLocale: 'zh_CN',
    },
    en: {
      title: 'SPACE8｜Self-Service Chinese Pool, San Po Kong, Open 06:00–24:00',
      description: "Self-service, smoke-free Chinese pool club in San Po Kong, Kowloon. Open daily 06:00–24:00. Book online, enter by QR code, pay with Apple Pay. Near MTR Diamond Hill and Kai Tak.",
      keywords: ['Chinese pool', 'Chinese eight-ball', 'pool Hong Kong', 'San Po Kong pool', 'Kowloon pool', 'self service pool', 'smoke-free pool room'],
      ogTitle: 'SPACE8',
      ogDesc: 'Self-Service Chinese Pool · San Po Kong · Open Daily 06:00–24:00',
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

  const t = await getTranslations({ locale, namespace: 'faq' });
  const faqJsonLd = getFaqJsonLd(t);
  const sportsClubJsonLd = buildSportsClubJsonLd(locale, locale === "zh-HK" ? "/" : `/${locale}`);
  const config = await getConfig();

  return (
    <main className="relative bg-black" style={{ isolation: "isolate" }}>
      <script type="application/ld+json">{safeJsonLd(sportsClubJsonLd)}</script>
      <AmbientGlow />
      <Nav />
      <Hero />
      <Gallery />
      <HowItWorks />
      <PeriodPricingSections periods={config.periods} />

      {/* Learn More scroll target — zero-height anchor, sections flow directly */}
      <div id="social-proof" aria-hidden="true" />

      {/* Membership — last section before footer */}
      <Member />

      {/* FAQ — above the footer */}
      <FAQ jsonLd={faqJsonLd} />

      <Footer />

      {/* Floating contact CTA — mobile only. AI chat by default; becomes an
          AI-edit entry point when an admin has edit-mode on. */}
      <ContactButton />
    </main>
  );
}
