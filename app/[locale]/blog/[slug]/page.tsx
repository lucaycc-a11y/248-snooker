import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import dynamic from "next/dynamic";
import Nav from "@/components/layout/Nav";
import Footer from "@/components/layout/Footer";
import { Link } from "@/i18n/navigation";
import { getBlogPost, getRelatedPosts } from "@/lib/data/getBlog";
import { safeJsonLd } from "@/lib/seo/jsonLd";

// ── Heavy content rendering (lazy load) ──────────────────────────────────────
const BlogArticleContent = dynamic(
  () => import("./BlogArticleContent"),
  { ssr: true }
);

const BASE = "https://space8.com.hk";

function localePath(locale: string, slug: string): string {
  return locale === "zh-HK" ? `/blog/${slug}` : `/${locale}/blog/${slug}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const post = await getBlogPost(slug, locale);

  if (!post) {
    return { title: "404 | Space8", robots: { index: false, follow: false } };
  }

  const title = post.seo_title || `${post.title} | Space8`;
  const description = post.seo_description || post.excerpt || undefined;
  const ogImage = post.og_image_url || post.cover_image_url;

  return {
    title,
    description,
    alternates: { canonical: `${BASE}${localePath(locale, slug)}` },
    openGraph: {
      title,
      description,
      url: `${BASE}${localePath(locale, slug)}`,
      siteName: "Space8",
      type: "article",
      publishedTime: post.published_at ?? undefined,
      authors: post.author ? [post.author] : undefined,
      images: ogImage ? [{ url: ogImage, width: 1200, height: 630, alt: post.title }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
    robots: { index: true, follow: true },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const post = await getBlogPost(slug, locale);
  if (!post) notFound();

  const t = await getTranslations({ locale, namespace: "blog" });
  const related = await getRelatedPosts(post);
  const cover = post.cover_image_url || post.og_image_url;
  const url = `${BASE}${localePath(locale, slug)}`;

  // Article structured data for rich results.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.seo_description || post.excerpt || undefined,
    image: cover || undefined,
    datePublished: post.published_at || undefined,
    author: { "@type": "Organization", name: post.author || "Space8" },
    publisher: {
      "@type": "Organization",
      name: "Space8",
      logo: { "@type": "ImageObject", url: `${BASE}/logos/logo-black-horizontal.svg` },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
  };

  return (
    <main className="relative bg-black">
      <Nav />
      <script type="application/ld+json">{safeJsonLd(jsonLd)}</script>
      <BlogArticleContent
        post={post}
        related={related}
        locale={locale}
        url={url}
        t={t}
      />
      <Footer />
    </main>
  );
}
