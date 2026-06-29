import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import Nav from "@/components/layout/Nav";
import Footer from "@/components/layout/Footer";
import WhatsAppButton from "@/components/shared/WhatsAppButton";
import { safeJsonLd } from "@/lib/seo/jsonLd";
import AboutContent from "./AboutContent";

const BASE = "https://248.formhk.com";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "aboutPage" });
  const path = locale === "zh-HK" ? "/about" : `/${locale}/about`;

  const titles: Record<string, string> = {
    "zh-HK": "關於我們 | 248 Snooker",
    "zh-CN": "关于我们 | 248 Snooker",
    en: "About | 248 Snooker",
    ja: "私たちについて | 248 Snooker",
  };

  return {
    title: titles[locale] ?? titles["zh-HK"],
    description: t("hero_subtitle"),
    alternates: {
      canonical: `${BASE}${path}`,
      languages: {
        "zh-HK": `${BASE}/about`,
        "zh-CN": `${BASE}/zh-CN/about`,
        en: `${BASE}/en/about`,
        ja: `${BASE}/ja/about`,
      },
    },
    openGraph: {
      title: titles[locale] ?? titles["zh-HK"],
      description: t("hero_subtitle"),
      url: `${BASE}${path}`,
      siteName: "248 Snooker",
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

  // LocalBusiness (SportsClub) structured data — 24/7 hours, contact.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SportsClub",
    name: "248 Snooker",
    description: "香港首間24小時自助英式桌球預訂平台",
    url: `${BASE}${locale === "zh-HK" ? "/about" : `/${locale}/about`}`,
    telephone: "+85264274620",
    email: "info.formhk@gmail.com",
    address: {
      "@type": "PostalAddress",
      addressCountry: "HK",
      addressRegion: "Hong Kong",
    },
    openingHoursSpecification: {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
      opens: "00:00",
      closes: "23:59",
    },
    priceRange: "HK$60-80/hr",
  };

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
