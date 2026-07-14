import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
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
  const t = await getTranslations({ locale, namespace: "aboutPage" });
  const path = locale === "zh-HK" ? "/about" : `/${locale}/about`;

  const titles: Record<string, string> = {
    "zh-HK": "關於我們 | Space8",
    "zh-CN": "关于我们 | Space8",
    en: "About | Space8",
    ja: "私たちについて | Space8",
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
