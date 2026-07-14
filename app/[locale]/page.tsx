import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import Nav from "@/components/layout/Nav";
import Hero from "@/components/landing/Hero";
import Gallery from "@/components/landing/Gallery";
import HowItWorks from "@/components/landing/HowItWorks";
import Pricing from "@/components/landing/Pricing";
import Member from "@/components/landing/Member";
import FAQ from "@/components/landing/FAQ";
import Footer from "@/components/layout/Footer";
import ContactButton from "@/components/shared/ContactButton";
import { AmbientGlow } from "@/components/shared/AmbientGlow";
import { getFaqListData, getFaqJsonLdFromItems } from "@/lib/data/getFaqData";
import { buildSportsClubJsonLd, safeJsonLd } from "@/lib/seo/jsonLd";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;

  const meta: Record<string, { title: string; description: string; keywords: string[]; ogTitle: string; ogDesc: string; canonical: string; ogLocale: string }> = {
    'zh-HK': {
      title: 'Space8 · 香港自助桌球會所 每日06:00-24:00營業',
      description: '香港首間自助英式桌球預訂平台，每日06:00至24:00營業。即時確認，Apple Pay付款，QR碼入場。',
      keywords: ['桌球', '斯諾克', '香港桌球', '自助桌球會所', '自助桌球', '英式桌球'],
      ogTitle: 'Space8',
      ogDesc: '香港自助桌球會所 · 每日06:00-24:00營業',
      canonical: 'https://space8.com.hk',
      ogLocale: 'zh_HK',
    },
    'zh-CN': {
      title: 'Space8 · 香港自助台球会所 每日06:00-24:00营业',
      description: '香港首家自助英式台球预订平台，每日06:00至24:00营业。即时确认，Apple Pay付款，二维码入场。',
      keywords: ['台球', '斯诺克', '香港台球', '自助台球会所', '自助台球', '英式台球'],
      ogTitle: 'Space8',
      ogDesc: '香港自助台球会所 · 每日06:00-24:00营业',
      canonical: 'https://space8.com.hk/zh-CN',
      ogLocale: 'zh_CN',
    },
    en: {
      title: 'Space8 · Snooker Club Hong Kong, Open Daily 06:00–24:00',
      description: "Hong Kong's first self-service snooker booking platform, open daily 06:00–24:00. Instant confirmation, Apple Pay, QR code entry.",
      keywords: ['snooker', 'Hong Kong snooker', 'self service snooker club', 'self service snooker', 'billiards HK'],
      ogTitle: 'Space8',
      ogDesc: 'Snooker Club Hong Kong · Open Daily 06:00–24:00',
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
          alt: 'Space8 Club Hong Kong',
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
  const faqItems = await getFaqListData(locale, t);
  const faqJsonLd = getFaqJsonLdFromItems(faqItems);
  const sportsClubJsonLd = buildSportsClubJsonLd(locale, locale === "zh-HK" ? "/" : `/${locale}`);

  return (
    <main className="relative bg-black" style={{ isolation: "isolate" }}>
      <script type="application/ld+json">{safeJsonLd(sportsClubJsonLd)}</script>
      <AmbientGlow />
      <Nav />
      <Hero />
      <Gallery />
      <HowItWorks />
      <Pricing />

      {/* Learn More scroll target — zero-height anchor, sections flow directly */}
      <div id="social-proof" aria-hidden="true" />

      {/* Membership — last section before footer */}
      <Member />

      {/* FAQ — above the footer */}
      <FAQ initialItems={faqItems} jsonLd={faqJsonLd} />

      <Footer />

      {/* Floating contact CTA — mobile only. AI chat by default; becomes an
          AI-edit entry point when an admin has edit-mode on. */}
      <ContactButton />
    </main>
  );
}
