import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Nav from "@/components/layout/Nav";
import Footer from "@/components/layout/Footer";
import FAQ from "@/components/landing/FAQ";
import { getFaqJsonLd } from "@/components/landing/faqData";

const BASE = "https://space8.com.hk";

const META: Record<string, { title: string; description: string; keywords: string }> = {
  "zh-HK": {
    title: "常見問題｜SPACE8 新蒲崗自助中式桌球室",
    description:
      "SPACE8 常見問題解答：預訂流程、QR 碼入場方式、收費、取消政策、會員積分制度等。香港新蒲崗自助無煙中式桌球室，每日 06:00 至 24:00 營業。",
    keywords: "中式桌球,中八,新蒲崗桌球,鑽石山桌球,九龍桌球,自助桌球,桌球預訂",
  },
  "zh-CN": {
    title: "常见问题｜SPACE8 新蒲岗自助中式台球室",
    description:
      "SPACE8 常见问题解答：预订流程、二维码入场方式、收费、取消政策、会员积分制度等。香港新蒲岗自助无烟中式台球室，每日 06:00 至 24:00 营业。",
    keywords: "中式台球,中八,新蒲岗台球,钻石山台球,九龙台球,自助台球,台球预订",
  },
  en: {
    title: "FAQ｜SPACE8 Self-Service Chinese Pool, San Po Kong",
    description:
      "SPACE8 FAQ: booking flow, QR-code entry, pricing, cancellation policy, membership tiers. Self-service, smoke-free Chinese pool club in San Po Kong, Kowloon, open daily 06:00–24:00.",
    keywords: "Chinese pool, Chinese eight-ball, San Po Kong pool, Kowloon pool, self service pool, pool booking",
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
        "x-default": `${BASE}/faq`,
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
  const faqJsonLd = getFaqJsonLd(t);

  return (
    <main className="relative bg-black">
      <Nav />
      <FAQ jsonLd={faqJsonLd} />
      <Footer />
    </main>
  );
}
