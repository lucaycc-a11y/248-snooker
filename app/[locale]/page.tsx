import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import Nav from "@/components/layout/Nav";
import Hero from "@/components/landing/Hero";
import Gallery from "@/components/landing/Gallery";
import HowItWorks from "@/components/landing/HowItWorks";
import Pricing from "@/components/landing/Pricing";
import Member from "@/components/landing/Member";
import FAQ from "@/components/landing/FAQ";
import Footer from "@/components/layout/Footer";
import WhatsAppButton from "@/components/shared/WhatsAppButton";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;

  const meta: Record<string, { title: string; description: string; keywords: string[]; ogTitle: string; ogDesc: string; canonical: string; ogLocale: string }> = {
    'zh-HK': {
      title: '248 Snooker · 香港24小時自助桌球會所',
      description: '香港首間24小時自助英式桌球預訂平台。即時確認，Apple Pay付款，QR碼入場。',
      keywords: ['桌球', '斯諾克', '香港桌球', '24小時桌球', '自助桌球', '英式桌球'],
      ogTitle: '248 Snooker',
      ogDesc: '香港24小時自助桌球會所',
      canonical: 'https://248.formhk.com',
      ogLocale: 'zh_HK',
    },
    'zh-CN': {
      title: '248 Snooker · 香港24小时自助台球会所',
      description: '香港首家24小时自助英式台球预订平台。即时确认，Apple Pay付款，二维码入场。',
      keywords: ['台球', '斯诺克', '香港台球', '24小时台球', '自助台球', '英式台球'],
      ogTitle: '248 Snooker',
      ogDesc: '香港24小时自助台球会所',
      canonical: 'https://248.formhk.com/zh-CN',
      ogLocale: 'zh_CN',
    },
    en: {
      title: '248 Snooker · 24-Hour Snooker Club Hong Kong',
      description: "Hong Kong's first 24-hour self-service snooker booking platform. Instant confirmation, Apple Pay, QR code entry.",
      keywords: ['snooker', 'Hong Kong snooker', '24 hour snooker', 'self service snooker', 'billiards HK'],
      ogTitle: '248 Snooker',
      ogDesc: '24-Hour Snooker Club Hong Kong',
      canonical: 'https://248.formhk.com/en',
      ogLocale: 'en_HK',
    },
    ja: {
      title: '248 Snooker · 香港24時間スヌーカークラブ',
      description: '香港初の24時間セルフサービス・スヌーカー予約プラットフォーム。即時確認、Apple Pay決済、QRコード入場。',
      keywords: ['スヌーカー', '香港スヌーカー', '24時間スヌーカー', 'ビリヤード香港'],
      ogTitle: '248 Snooker',
      ogDesc: '香港24時間スヌーカークラブ',
      canonical: 'https://248.formhk.com/ja',
      ogLocale: 'ja_JP',
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
      siteName: '248 Snooker',
      locale: m.ogLocale,
      type: 'website',
      images: [
        {
          url: 'https://248.formhk.com/og-image.png',
          width: 1200,
          height: 630,
          alt: '248 Snooker Club Hong Kong',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: '248 Snooker',
      description: m.ogDesc,
      images: ['https://248.formhk.com/og-image.png'],
    },
    alternates: {
      canonical: m.canonical,
      languages: {
        'zh-HK': 'https://248.formhk.com',
        'zh-CN': 'https://248.formhk.com/zh-CN',
        en: 'https://248.formhk.com/en',
        ja: 'https://248.formhk.com/ja',
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

  return (
    <main className="relative bg-black">
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
      <FAQ />

      <Footer />

      {/* Floating WhatsApp CTA — mobile only */}
      <WhatsAppButton />
    </main>
  );
}
