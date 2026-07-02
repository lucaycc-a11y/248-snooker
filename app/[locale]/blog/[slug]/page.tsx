import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import Nav from "@/components/layout/Nav";
import Footer from "@/components/layout/Footer";
import { Link } from "@/i18n/navigation";
import { getBlogPost, getRelatedPosts } from "@/lib/data/getBlog";
import { renderRichText } from "@/lib/blog/renderRichText";
import { safeJsonLd } from "@/lib/seo/jsonLd";
import ShareButtons from "./ShareButtons";

const SUBTLE = "#86868B";
const GREEN = "#22C55E";
const BORDER_DARK = "#2D2D2D";
const BASE = "https://248.formhk.com";

const FONT_FAMILY =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Helvetica, Arial, sans-serif";

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

function formatDate(iso: string | null, locale: string): string {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat(locale, { year: "numeric", month: "long", day: "numeric" }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
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
      logo: { "@type": "ImageObject", url: `${BASE}/logos/Space8_full_icon_black_white_bkg.svg` },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
  };

  return (
    <main className="relative bg-black" style={{ fontFamily: FONT_FAMILY }}>
      <Nav />
      {/* JSON-LD — escaped so dynamic fields can't break out of the script tag. */}
      <script type="application/ld+json">{safeJsonLd(jsonLd)}</script>

      {/* Hero — cover image full-width with dark overlay (or gradient fallback) */}
      <section
        data-nav-theme="dark"
        style={{
          position: "relative",
          minHeight: "clamp(360px, 56vh, 620px)",
          display: "flex",
          alignItems: "flex-end",
          background: cover ? "#0A0A0A" : "linear-gradient(135deg, #134E2A 0%, #0A0A0A 100%)",
          overflow: "hidden",
        }}
      >
        {cover && (
          <Image src={cover} alt={post.title} fill priority sizes="100vw" style={{ objectFit: "cover" }} />
        )}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.2) 40%, rgba(0,0,0,0.85) 100%)",
          }}
        />
        <div style={{ position: "relative", zIndex: 1, maxWidth: "720px", width: "100%", margin: "0 auto", padding: "0 24px 56px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
            {post.category && (
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  color: GREEN,
                  background: "rgba(34,197,94,0.15)",
                  borderRadius: "100px",
                  padding: "4px 12px",
                }}
              >
                {post.category}
              </span>
            )}
            <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.7)" }}>
              {formatDate(post.published_at, locale)}
            </span>
          </div>
          <h1 style={{ fontSize: "clamp(32px, 6vw, 56px)", fontWeight: 700, letterSpacing: "-0.03em", color: "white", margin: 0, lineHeight: 1.1 }}>
            {post.title}
          </h1>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "20px", fontSize: "14px", color: "rgba(255,255,255,0.7)" }}>
            <span>{post.author || "Space8"}</span>
            <span aria-hidden="true">·</span>
            <span>{t("read_time", { min: post.reading_time ?? 5 })}</span>
          </div>
        </div>
      </section>

      {/* Article body — admin HTML is parsed into an allowlisted React tree
          (lib/blog/renderRichText), never injected as raw markup. */}
      <article
        data-nav-theme="dark"
        style={{ background: "#000", color: "white", padding: "clamp(48px, 7vw, 80px) 24px" }}
      >
        <div style={{ maxWidth: "720px", margin: "0 auto" }}>
          {post.content ? (
            <div className="blog-prose">{renderRichText(post.content)}</div>
          ) : post.excerpt ? (
            <p style={{ fontSize: "18px", lineHeight: 1.7, color: "rgba(255,255,255,0.8)" }}>{post.excerpt}</p>
          ) : null}

          {/* Share + back */}
          <div style={{ marginTop: "56px", paddingTop: "32px", borderTop: `1px solid ${BORDER_DARK}`, display: "flex", flexDirection: "column", gap: "32px" }}>
            <ShareButtons url={url} title={post.title} />
            <Link
              href="/blog"
              style={{ display: "inline-flex", alignItems: "center", gap: "8px", color: GREEN, fontSize: "15px", textDecoration: "none" }}
              data-cms-key="blog.back_to_blog"
            >
              <ArrowLeft size={16} strokeWidth={2} />
              {t("back_to_blog")}
            </Link>
          </div>
        </div>
      </article>

      {/* Related posts */}
      {related.length > 0 && (
        <section
          data-nav-theme="dark"
          style={{ background: "#0A0A0A", color: "white", padding: "clamp(56px, 8vw, 96px) 24px", borderTop: `1px solid ${BORDER_DARK}` }}
        >
          <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
            <h2 style={{ fontSize: "28px", fontWeight: 700, letterSpacing: "-0.02em", margin: "0 0 32px" }} data-cms-key="blog.related_title">
              {t("related_title")}
            </h2>
            <div style={{ display: "grid", gap: "32px", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
              {related.map((r) => {
                const rCover = r.cover_image_url || r.og_image_url;
                return (
                  <Link key={r.id} href={`/blog/${r.slug}`} style={{ textDecoration: "none", color: "inherit" }}>
                    <div
                      style={{
                        position: "relative",
                        aspectRatio: "16 / 10",
                        borderRadius: "16px",
                        overflow: "hidden",
                        background: rCover ? "#1C1C1E" : "linear-gradient(135deg, #1A3A5C 0%, #0A0A0A 100%)",
                        border: `1px solid ${BORDER_DARK}`,
                      }}
                    >
                      {rCover && <Image src={rCover} alt={r.title} fill sizes="(max-width: 768px) 100vw, 33vw" style={{ objectFit: "cover" }} />}
                    </div>
                    <h3 style={{ fontSize: "17px", fontWeight: 600, color: "white", margin: "12px 0 4px", lineHeight: 1.3 }}>{r.title}</h3>
                    <span style={{ fontSize: "13px", color: SUBTLE }}>{formatDate(r.published_at, locale)}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <Footer />
    </main>
  );
}
