import type { Metadata } from "next";
import { pageAlternates } from "@/lib/seo/site";
import { setRequestLocale, getTranslations } from "next-intl/server";
import dynamic from "next/dynamic";
import Nav from "@/components/layout/Nav";
import Footer from "@/components/layout/Footer";
import { getBlogPosts } from "@/lib/data/getBlog";

// ── Main content (lazy load) ────────────────────────────────────────────────
const BlogList = dynamic(
  () => import("./BlogList"),
  { ssr: true }
);

const BASE = "https://space8.com.hk";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "blog" });
  const path = locale === "zh-HK" ? "/blog" : `/${locale}/blog`;

  return {
    title: t("meta_title"),
    description: t("meta_description"),
    alternates: pageAlternates(locale, "/blog"),
    openGraph: {
      title: t("meta_title"),
      description: t("meta_description"),
      url: `${BASE}${path}`,
      siteName: "Space8",
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
