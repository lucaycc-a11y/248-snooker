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
  const zh = locale === "zh";
  return {
    title: zh
      ? "248 Snooker · 香港24小時自助桌球會所"
      : "248 Snooker · 24-Hour Self-Service Snooker Club Hong Kong",
    description: zh
      ? "香港首間24小時自助英式桌球預訂平台。即時確認，Apple Pay付款，QR碼入場。"
      : "Hong Kong's first 24-hour self-service snooker booking platform. Instant confirmation, Apple Pay, QR code entry.",
    keywords: zh
      ? ["桌球", "斯諾克", "香港桌球", "24小時桌球", "自助桌球", "英式桌球"]
      : ["snooker", "Hong Kong snooker", "24 hour snooker", "self service snooker", "billiards HK"],
    openGraph: {
      title: "248 Snooker",
      description: zh ? "香港24小時自助桌球會所" : "24-Hour Snooker Club Hong Kong",
      url: zh ? "https://248.formhk.com" : "https://248.formhk.com/en",
      siteName: "248 Snooker",
      locale: zh ? "zh_HK" : "en_HK",
      type: "website",
      images: [
        {
          url: "https://248.formhk.com/og-image.png",
          width: 1200,
          height: 630,
          alt: "248 Snooker Club Hong Kong",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "248 Snooker",
      description: zh ? "香港24小時自助桌球" : "24-Hour Snooker Hong Kong",
      images: ["https://248.formhk.com/og-image.png"],
    },
    alternates: {
      canonical: zh ? "https://248.formhk.com" : "https://248.formhk.com/en",
      languages: {
        "zh-HK": "https://248.formhk.com",
        "en-HK": "https://248.formhk.com/en",
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
