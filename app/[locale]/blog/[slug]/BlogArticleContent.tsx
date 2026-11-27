"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { renderRichText } from "@/lib/blog/renderRichText";
import type { BlogPost } from "@/lib/data/getBlog";
import ShareButtons from "./ShareButtons";
import { renderBlogCta, type CtaText } from "@/components/blog/BlogCta";

const SUBTLE = "#A1A1A6";
const GREEN = "#22C55E";
const BORDER_DARK = "#2D2D2D";
const GT = "'Good Times', 'JetBrains Mono', monospace";
const FONT =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Helvetica, Arial, sans-serif";

function dotDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10).replace(/-/g, ".");
  return new Date(d.getTime() + 8 * 3600 * 1000).toISOString().slice(0, 10).replace(/-/g, ".");
}

type TocItem = { id: string; text: string; level: 2 | 3 };

/** Thin green bar at the top of the viewport showing how far through the article the reader is. */
function ReadingProgress({ target }: { target: React.RefObject<HTMLElement | null> }) {
  const barRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const el = target.current;
      const bar = barRef.current;
      if (!el || !bar) return;
      const rect = el.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      const done = total <= 0 ? 1 : Math.min(1, Math.max(0, -rect.top / total));
      bar.style.transform = `scaleX(${done})`;
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [target]);
  return (
    <div aria-hidden="true" style={{ position: "fixed", top: 0, left: 0, right: 0, height: 3, zIndex: 70, background: "transparent", pointerEvents: "none" }}>
      <div ref={barRef} style={{ height: "100%", background: GREEN, transformOrigin: "left", transform: "scaleX(0)", willChange: "transform" }} />
    </div>
  );
}

export default function BlogArticleContent({
  post,
  related,
  locale,
  url,
}: {
  post: BlogPost;
  related: BlogPost[];
  locale: string;
  url: string;
}) {
  const t = useTranslations("blog");
  const cover = post.cover_image_url || post.og_image_url;
  const articleRef = useRef<HTMLElement>(null);
  const proseRef = useRef<HTMLDivElement>(null);
  const [toc, setToc] = useState<TocItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const ctaText: CtaText = {
    booking_title: t("cta_booking_title"), booking_text: t("cta_booking_text"), booking_label: t("cta_booking_label"),
    member_title: t("cta_member_title"), member_text: t("cta_member_text"), member_label: t("cta_member_label"),
  };
  const categoryLabel = post.category ? (t.has(`filter_${post.category}`) ? t(`filter_${post.category}`) : post.category) : null;

  // Build the table of contents from the rendered headings (the renderer does not emit ids).
  useEffect(() => {
    const root = proseRef.current;
    if (!root) return;
    const heads = Array.from(root.querySelectorAll<HTMLHeadingElement>("h2, h3"));
    const items: TocItem[] = heads.map((h, i) => {
      if (!h.id) h.id = `section-${i + 1}`;
      h.style.scrollMarginTop = "96px";
      return { id: h.id, text: (h.textContent ?? "").trim(), level: h.tagName === "H3" ? (3 as const) : (2 as const) };
    }).filter((x) => x.text !== "");
    setToc(items);
    if (items.length === 0 || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (hit) setActiveId(hit.target.id);
      },
      { rootMargin: "-80px 0px -70% 0px" },
    );
    heads.forEach((h) => io.observe(h));
    return () => io.disconnect();
  }, [post.id]);

  return (
    <div style={{ fontFamily: FONT }}>
      <ReadingProgress target={articleRef} />

      <section
        data-nav-theme="dark"
        style={{ position: "relative", minHeight: "clamp(380px, 60vh, 640px)", display: "flex", alignItems: "flex-end", background: cover ? "#0A0A0A" : "linear-gradient(135deg, #134E2A 0%, #0A0A0A 100%)", overflow: "hidden" }}
      >
        {cover && <Image src={cover} alt={post.title} fill priority sizes="100vw" style={{ objectFit: "cover" }} />}
        <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.2) 40%, rgba(0,0,0,0.9) 100%)" }} />
        <div style={{ position: "relative", zIndex: 1, maxWidth: 820, width: "100%", margin: "0 auto", padding: "0 24px 56px" }}>
          <Link href="/blog" style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "rgba(255,255,255,0.75)", fontSize: 14, textDecoration: "none", marginBottom: 28 }}>
            <ArrowLeft size={15} strokeWidth={2} aria-hidden="true" />
            {t("back_to_blog")}
          </Link>
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
            {categoryLabel && (
              <span style={{ fontSize: 12, fontWeight: 600, color: GREEN, background: "rgba(34,197,94,0.16)", borderRadius: 100, padding: "4px 12px" }}>{categoryLabel}</span>
            )}
            {post.published_at && (
              <time dateTime={post.published_at} style={{ fontFamily: GT, fontSize: 12, letterSpacing: "0.08em", color: "rgba(255,255,255,0.75)" }}>{dotDate(post.published_at)}</time>
            )}
          </div>
          <h1 style={{ fontSize: "clamp(32px, 6vw, 56px)", fontWeight: 700, letterSpacing: "-0.03em", color: "white", margin: 0, lineHeight: 1.12 }}>{post.title}</h1>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 20, fontSize: 14, color: "rgba(255,255,255,0.7)" }}>
            <span>{post.author || "Space8"}</span>
            <span aria-hidden="true">·</span>
            <span>{t("read_time", { min: post.reading_time ?? 5 })}</span>
          </div>
        </div>
      </section>

      <article ref={articleRef} data-nav-theme="dark" style={{ background: "#000", color: "white", padding: "clamp(48px, 7vw, 80px) 24px" }}>
        <div className="bl-article-grid">
          <div>
            {post.content ? (
              <div ref={proseRef} className="blog-prose">
                {renderRichText(post.content, { component: (kind, attrs, key) => renderBlogCta(kind, attrs, key, ctaText, locale) })}
              </div>
            ) : post.excerpt ? (
              <p style={{ fontSize: 18, lineHeight: 1.7, color: "rgba(255,255,255,0.8)" }}>{post.excerpt}</p>
            ) : null}

            <div style={{ marginTop: 56, paddingTop: 32, borderTop: `1px solid ${BORDER_DARK}`, display: "flex", flexDirection: "column", gap: 32 }}>
              <ShareButtons url={url} title={post.title} />
              <Link href="/blog" style={{ display: "inline-flex", alignItems: "center", gap: 8, color: GREEN, fontSize: 15, textDecoration: "none" }}>
                <ArrowLeft size={16} strokeWidth={2} aria-hidden="true" />
                {t("back_to_blog")}
              </Link>
            </div>
          </div>

          {toc.length > 1 && (
            <aside className="bl-toc-wrap" aria-label={t("toc_title")}>
              <nav className="bl-toc" style={{ position: "sticky", top: 112 }}>
                <div style={{ fontFamily: GT, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: SUBTLE, marginBottom: 12 }}>{t("toc_title")}</div>
                {toc.map((item) => (
                  <a key={item.id} href={`#${item.id}`} aria-current={activeId === item.id ? "true" : undefined} style={item.level === 3 ? { paddingLeft: 28 } : undefined}>
                    {item.text}
                  </a>
                ))}
              </nav>
            </aside>
          )}
        </div>
      </article>

      {related.length > 0 && (
        <section data-nav-theme="dark" style={{ background: "#0A0A0A", color: "white", padding: "clamp(56px, 8vw, 96px) 24px", borderTop: `1px solid ${BORDER_DARK}` }}>
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>
            <h2 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", margin: "0 0 32px" }}>{t("related_title")}</h2>
            <div style={{ display: "grid", gap: 32, gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
              {related.map((r) => {
                const rCover = r.cover_image_url || r.og_image_url;
                return (
                  <Link key={r.id} href={`/blog/${r.slug}`} className="bl-card">
                    <div className="bl-cover" style={{ position: "relative", aspectRatio: "16 / 10", borderRadius: 16, overflow: "hidden", background: rCover ? "#1C1C1E" : "linear-gradient(135deg, #1A3A5C 0%, #0A0A0A 100%)", border: `1px solid ${BORDER_DARK}` }}>
                      {rCover && <Image className="bl-img" src={rCover} alt={r.title} fill sizes="(max-width: 768px) 100vw, 33vw" style={{ objectFit: "cover" }} />}
                    </div>
                    <h3 style={{ fontSize: 17, fontWeight: 600, color: "white", margin: "12px 0 4px", lineHeight: 1.3 }}>{r.title}</h3>
                    {r.published_at && <time dateTime={r.published_at} style={{ fontFamily: GT, fontSize: 11, letterSpacing: "0.06em", color: SUBTLE }}>{dotDate(r.published_at)}</time>}
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
