import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Nav from "@/components/layout/Nav";
import Footer from "@/components/layout/Footer";
import FAQ from "@/components/landing/FAQ";
import { getFaqListData, getFaqJsonLdFromItems } from "@/lib/data/getFaqData";

const BASE = "https://space8.com.hk";

const META: Record<string, { title: string; description: string; keywords: string }> = {
  "zh-HK": {
    title: "常見問題 | Space8 — 香港自助中式桌球 06:00-24:00營業",
    description:
      "Space8常見問題解答：預訂流程、入場方式、收費、取消政策、會員積分制度等。香港首間自助中式桌球會所，每日06:00至24:00營業。",
    keywords: "中式桌球,香港桌球,桌球會所,自助桌球,桌球預訂,中八",
  },
  "zh-CN": {
    title: "常见问题 | Space8 — 香港自助中式台球 06:00-24:00营业",
    description:
      "Space8常见问题解答：预订流程、入场方式、收费、取消政策、会员积分制度等。香港首家自助中式台球会所，每日06:00至24:00营业。",
    keywords: "中式台球,香港台球,台球会所,自助台球,台球预订,中八",
  },
  en: {
    title: "FAQ | Space8 — Chinese Eight-Ball Hong Kong, Open Daily 06:00–24:00",
    description:
      "Space8 FAQ: booking flow, entry method, pricing, cancellation policy, membership tiers. Hong Kong's first self-service Chinese eight-ball club, open daily 06:00–24:00.",
    keywords: "Chinese eight-ball, Hong Kong pool, self service pool club, Chinese eight-ball booking",
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const m = META[locale] ?? META["zh-HK"];
  const path = locale === "zh-HK" ? "/faq" : `/${locale}/faq`;

  return {
    title: m.title,
    description: m.description,
    keywords: m.keywords,
    alternates: {
      canonical: `${BASE}${path}`,
      languages: {
        "zh-HK": `${BASE}/faq`,
        "zh-CN": `${BASE}/zh-CN/faq`,
        en: `${BASE}/en/faq`,
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

export default async function FaqPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'faq' });
  const faqItems = await getFaqListData(locale, t);
  const faqJsonLd = getFaqJsonLdFromItems(faqItems);

  return (
    <main className="relative bg-black">
      <Nav />
      <FAQ initialItems={faqItems} jsonLd={faqJsonLd} />
      <Footer />
    </main>
  );
}
