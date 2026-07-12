import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Nav from "@/components/layout/Nav";
import FAQ from "@/components/landing/FAQ";
import { getFaqListData, getFaqJsonLdFromItems } from "@/lib/data/getFaqData";

export const metadata: Metadata = {
  title: "常見問題 | Space8 — 香港自助桌球 06:00-24:00營業",
  description:
    "Space8常見問題解答：預訂流程、入場方式、收費、取消政策、會員積分制度等。香港首間自助桌球會所，每日06:00至24:00營業。",
  keywords:
    "桌球,香港桌球,桌球會所,自助桌球,桌球預訂,snooker hong kong",
  alternates: {
    canonical: "https://space8.com.hk/faq",
  },
};

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
    </main>
  );
}
