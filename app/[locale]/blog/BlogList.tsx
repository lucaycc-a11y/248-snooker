"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { BlogPost } from "@/lib/data/getBlog";

const SUBTLE = "#86868B";
const GREEN = "#22C55E";
const BORDER_DARK = "#2D2D2D";

const FONT_FAMILY =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Helvetica, Arial, sans-serif";

const EASE = [0.16, 1, 0.3, 1] as const;
const VIEWPORT = { once: true, amount: 0.2 } as const;

const CATEGORIES = [
  { id: "all", key: "filter_all" },
  { id: "tutorial", key: "filter_tutorial" },
  { id: "venue", key: "filter_venue" },
  { id: "event", key: "filter_event" },
  { id: "culture", key: "filter_culture" },
] as const;

// Deterministic gradient placeholder when a post has no cover image.
const GRADIENTS = [
  "linear-gradient(135deg, #134E2A 0%, #0A0A0A 100%)",
  "linear-gradient(135deg, #1A3A5C 0%, #0A0A0A 100%)",
  "linear-gradient(135deg, #3D2A1A 0%, #0A0A0A 100%)",
  "linear-gradient(135deg, #2A1A3D 0%, #0A0A0A 100%)",
];

function formatDate(iso: string | null, locale: string): string {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat(locale, { year: "numeric", month: "short", day: "numeric" }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

function PostCard({ post, index, locale }: { post: BlogPost; index: number; locale: string }) {
  const t = useTranslations("blog");
  const cover = post.cover_image_url || post.og_image_url;

  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={VIEWPORT}
      transition={{ duration: 0.5, ease: EASE, delay: Math.min(index * 0.06, 0.3) }}
    >
      <Link
        href={`/blog/${post.slug}`}
        style={{ textDecoration: "none", color: "inherit", display: "block" }}
        data-cms-key={`blog.post.${post.slug}`}
      >
        {/* Cover */}
        <div
          style={{
            position: "relative",
            aspectRatio: "16 / 10",
            borderRadius: "18px",
            overflow: "hidden",
            background: cover ? "#1C1C1E" : GRADIENTS[index % GRADIENTS.length],
            border: `1px solid ${BORDER_DARK}`,
          }}
        >
          {cover && (
            <Image
              src={cover}
              alt={post.title}
              fill
              sizes="(max-width: 768px) 100vw, 33vw"
              style={{ objectFit: "cover" }}
            />
          )}
        </div>

        {/* Category pill */}
        {post.category && (
          <span
            style={{
              display: "inline-block",
              marginTop: "16px",
              fontSize: "12px",
              fontWeight: 600,
              color: GREEN,
              background: "rgba(34,197,94,0.12)",
              borderRadius: "100px",
              padding: "4px 12px",
              letterSpacing: "0.02em",
            }}
          >
            {t.has(`filter_${post.category}`) ? t(`filter_${post.category}`) : post.category}
          </span>
        )}

        <h3
          style={{
            fontSize: "20px",
            fontWeight: 600,
            letterSpacing: "-0.01em",
            color: "white",
            margin: "12px 0 8px",
            lineHeight: 1.3,
          }}
        >
          {post.title}
        </h3>

        {post.excerpt && (
          <p
            style={{
              fontSize: "15px",
              lineHeight: 1.55,
              color: "rgba(255,255,255,0.6)",
              margin: "0 0 12px",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {post.excerpt}
          </p>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: SUBTLE }}>
          <span>{formatDate(post.published_at, locale)}</span>
          <span aria-hidden="true">·</span>
          <span>{t("read_time", { min: post.reading_time ?? 5 })}</span>
          {post.author && (
            <>
              <span aria-hidden="true">·</span>
              <span>{post.author}</span>
            </>
          )}
        </div>
      </Link>
    </motion.div>
  );
}

export default function BlogList({ posts, locale }: { posts: BlogPost[]; locale: string }) {
  const t = useTranslations("blog");
  const [filter, setFilter] = useState<string>("all");

  const filtered = useMemo(
    () => (filter === "all" ? posts : posts.filter((p) => p.category === filter)),
    [filter, posts],
  );

  const hasPosts = posts.length > 0;

  return (
    <div style={{ fontFamily: FONT_FAMILY, background: "#000", minHeight: "100vh" }}>
      {/* Hero */}
      <section data-nav-theme="dark" style={{ background: "#000", color: "white", padding: "160px 24px 56px" }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE }}
            style={{ fontSize: "clamp(44px, 9vw, 72px)", fontWeight: 700, letterSpacing: "-0.03em", margin: 0 }}
            data-cms-key="blog.title"
          >
            {t("title")}
          </motion.h1>
          <p style={{ fontSize: "18px", color: "rgba(255,255,255,0.6)", margin: "16px 0 0" }} data-cms-key="blog.subtitle">
            {t("subtitle")}
          </p>
        </div>
      </section>

      {hasPosts ? (
        <section data-nav-theme="dark" style={{ background: "#000", padding: "0 24px 120px" }}>
          <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
            {/* Category filter */}
            <div
              className="no-scrollbar"
              style={{ display: "flex", gap: "10px", overflowX: "auto", paddingBottom: "32px" }}
            >
              {CATEGORIES.map((c) => {
                const active = filter === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setFilter(c.id)}
                    data-cms-key={`blog.${c.key}`}
                    style={{
                      flexShrink: 0,
                      fontSize: "14px",
                      fontWeight: 500,
                      color: active ? "#000" : "white",
                      background: active ? "white" : "transparent",
                      border: `1px solid ${active ? "white" : "#3D3D3D"}`,
                      borderRadius: "100px",
                      padding: "9px 18px",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                      minHeight: 44,
                    }}
                  >
                    {t(c.key)}
                  </button>
                );
              })}
            </div>

            {/* Grid */}
            <div
              style={{
                display: "grid",
                gap: "32px",
                gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
              }}
            >
              {filtered.map((post, i) => (
                <PostCard key={post.id} post={post} index={i} locale={locale} />
              ))}
            </div>
          </div>
        </section>
      ) : (
        <ComingSoon />
      )}
    </div>
  );
}

function ComingSoon() {
  const t = useTranslations("blog");
  return (
    <section
      data-nav-theme="dark"
      style={{ background: "#000", color: "white", padding: "40px 24px 160px", textAlign: "center" }}
    >
      <div style={{ maxWidth: "480px", margin: "0 auto" }}>
        <h2 style={{ fontSize: "28px", fontWeight: 700, margin: "0 0 12px" }} data-cms-key="blog.coming_soon_title">
          {t("coming_soon_title")}
        </h2>
        <p style={{ fontSize: "16px", color: "rgba(255,255,255,0.6)", margin: "0 0 32px" }} data-cms-key="blog.coming_soon_body">
          {t("coming_soon_body")}
        </p>
        {/* Newsletter signup — visual only; wire to a real endpoint later. */}
        <form
          onSubmit={(e) => e.preventDefault()}
          style={{ display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "center" }}
        >
          <input
            type="email"
            required
            placeholder={t("newsletter_placeholder")}
            aria-label={t("newsletter_placeholder")}
            style={{
              flex: "1 1 220px",
              minHeight: 48,
              padding: "0 18px",
              borderRadius: "100px",
              border: `1px solid ${BORDER_DARK}`,
              background: "#0A0A0A",
              color: "white",
              fontSize: "15px",
            }}
          />
          <button
            type="submit"
            style={{
              minHeight: 48,
              padding: "0 28px",
              borderRadius: "100px",
              border: "none",
              background: GREEN,
              color: "#000",
              fontWeight: 700,
              fontSize: "15px",
              cursor: "pointer",
            }}
            data-cms-key="blog.newsletter_button"
          >
            {t("newsletter_button")}
          </button>
        </form>
      </div>
    </section>
  );
}
