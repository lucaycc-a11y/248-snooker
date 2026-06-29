import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import Nav from "@/components/layout/Nav";
import Footer from "@/components/layout/Footer";
import { getBlogPosts } from "@/lib/data/getBlog";
import BlogList from "./BlogList";

const BASE = "https://248.formhk.com";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "blog" });
  const path = locale === "zh-HK" ? "/blog" : `/${locale}/blog`;

  return {
    title: `${t("title")} | 248 Snooker`,
    description: t("subtitle"),
    alternates: {
      canonical: `${BASE}${path}`,
      languages: {
        "zh-HK": `${BASE}/blog`,
        "zh-CN": `${BASE}/zh-CN/blog`,
        en: `${BASE}/en/blog`,
        ja: `${BASE}/ja/blog`,
      },
    },
    openGraph: {
      title: `${t("title")} | 248 Snooker`,
      description: t("subtitle"),
      url: `${BASE}${path}`,
      siteName: "248 Snooker",
      type: "website",
    },
    robots: { index: true, follow: true },
  };
}

export default async function BlogPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const posts = await getBlogPosts(locale);

  return (
    <main className="relative bg-black">
      <Nav />
      <BlogList posts={posts} locale={locale} />
      <Footer />
    </main>
  );
}
