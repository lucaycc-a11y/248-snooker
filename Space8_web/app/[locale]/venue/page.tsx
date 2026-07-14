import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import Nav from "@/components/layout/Nav";
import Footer from "@/components/layout/Footer";
import WhatsAppButton from "@/components/shared/WhatsAppButton";
import { buildSportsClubJsonLd, safeJsonLd } from "@/lib/seo/jsonLd";
import VenueContent from "./VenueContent";

const BASE = "https://space8.com.hk";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "venue" });
  const path = locale === "zh-HK" ? "/venue" : `/${locale}/venue`;

  const titles: Record<string, string> = {
    "zh-HK": "場地 | Space8",
    "zh-CN": "场地 | Space8",
    en: "Venue | Space8",
  };

  return {
    title: titles[locale] ?? titles["zh-HK"],
    description: t("hero_subtitle"),
    alternates: {
      canonical: `${BASE}${path}`,
      languages: {
        "zh-HK": `${BASE}/venue`,
        "zh-CN": `${BASE}/zh-CN/venue`,
        en: `${BASE}/en/venue`,
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
      <VenueContent locale={locale} />
      <Footer />
      <WhatsAppButton />
    </main>
  );
}
