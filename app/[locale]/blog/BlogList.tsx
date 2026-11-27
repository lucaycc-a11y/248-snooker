"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import { Rss, Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { BlogPost } from "@/lib/data/getBlog";

const GREEN = "#22C55E";
const BORDER = "#2D2D2D";
const SUBTLE = "#A1A1A6";
const FONT =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', var(--font-noto-hk), 'PingFang HK', 'Noto Sans TC', 'Helvetica Neue', Arial, sans-serif";
const GT = "'Good Times', 'JetBrains Mono', monospace";
const EASE = [0.16, 1, 0.3, 1] as const;
const PAGE_SIZE = 9;
const KNOWN = ["tutorial", "venue", "event", "culture"] as const;

const GRADIENTS = [
  "linear-gradient(135deg, #134E2A 0%, #0A0A0A 100%)",
  "linear-gradient(135deg, #1A3A5C 0%, #0A0A0A 100%)",
  "linear-gradient(135deg, #3D2A1A 0%, #0A0A0A 100%)",
  "linear-gradient(135deg, #2A1A3D 0%, #0A0A0A 100%)",
];

type Sort = "curated" | "newest";

function dotDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10).replace(/-/g, ".");
  const hk = new Date(d.getTime() + 8 * 3600 * 1000).toISOString().slice(0, 10);
  return hk.replace(/-/g, ".");
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function Cover({ post, index, sizes, priority }: { post: BlogPost; index: number; sizes: string; priority?: boolean }) {
  const cover = post.cover_image_url || post.og_image_url;
  return (
    <div
      className="bl-cover"
      style={{
        position: "relative",
        aspectRatio: "16 / 10",
        borderRadius: 18,
        overflow: "hidden",
        background: cover ? "#1C1C1E" : GRADIENTS[index % GRADIENTS.length],
        border: `1px solid ${BORDER}`,
      }}
    >
      {cover && (
        <Image className="bl-img" src={cover} alt={post.title} fill sizes={sizes} priority={priority} style={{ objectFit: "cover" }} />
      )}
      <span
        aria-hidden="true"
        style={{ position: "absolute", left: 14, top: 12, fontFamily: GT, fontSize: 12, letterSpacing: "0.08em", color: "rgba(255,255,255,0.85)", textShadow: "0 1px 8px rgba(0,0,0,0.6)" }}
      >
        {pad(index + 1)}
      </span>
    </div>
  );
}

function Meta({ post, label }: { post: BlogPost; label: (c: string) => string }) {
  const t = useTranslations("blog");
  return (
    <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, fontSize: 13, color: SUBTLE }}>
      {post.category && (
        <span style={{ color: GREEN, fontWeight: 600 }}>{label(post.category)}</span>
      )}
      {post.published_at && (
        <>
          {post.category && <span aria-hidden="true">·</span>}
          <time dateTime={post.published_at} style={{ fontFamily: GT, fontSize: 11, letterSpacing: "0.06em" }}>{dotDate(post.published_at)}</time>
        </>
      )}
      <span aria-hidden="true">·</span>
      <span>{t("read_time", { min: post.reading_time ?? 5 })}</span>
    </div>
  );
}

function PostCard({ post, index, label }: { post: BlogPost; index: number; label: (c: string) => string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.5, ease: EASE, delay: Math.min((index % 3) * 0.06, 0.2) }}
    >
      <Link href={`/blog/${post.slug}`} className="bl-card">
        <Cover post={post} index={index} sizes="(max-width: 768px) 100vw, 33vw" />
        <div style={{ marginTop: 16 }}><Meta post={post} label={label} /></div>
        <h3 style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.01em", color: "white", margin: "10px 0 8px", lineHeight: 1.3 }}>{post.title}</h3>
        {post.excerpt && (
          <p style={{ fontSize: 15, lineHeight: 1.55, color: "rgba(255,255,255,0.6)", margin: 0, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{post.excerpt}</p>
        )}
      </Link>
    </motion.div>
  );
}

export default function BlogList({ posts, locale }: { posts: BlogPost[]; locale: string }) {
  const t = useTranslations("blog");
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("curated");
  const [visible, setVisible] = useState(PAGE_SIZE);

  const label = (c: string) => (t.has(`filter_${c}`) ? t(`filter_${c}`) : c);

  // Known categories first (in a fixed order), then any custom ones the admin typed.
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of posts) if (p.category) counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
    const known = KNOWN.filter((k) => counts.has(k));
    const custom = [...counts.keys()].filter((k) => !(KNOWN as readonly string[]).includes(k)).sort();
    return [...known, ...custom].map((id) => ({ id, count: counts.get(id) ?? 0 }));
  }, [posts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = posts.filter((p) => (filter === "all" || p.category === filter) && (!q || `${p.title} ${p.excerpt ?? ""} ${p.category ?? ""}`.toLowerCase().includes(q)));
    if (sort === "newest") list = [...list].sort((a, b) => (b.published_at ?? "").localeCompare(a.published_at ?? ""));
    return list;
  }, [posts, filter, query, sort]);

  const showFeature = filter === "all" && query.trim() === "" && filtered.length > 2;
  const feature = showFeature ? filtered[0] : null;
  const rest = feature ? filtered.slice(1) : filtered;
  const shown = rest.slice(0, visible);
  const isFiltering = filter !== "all" || query.trim() !== "";
  const rssHref = locale === "zh-HK" ? "/blog/feed.xml" : `/${locale}/blog/feed.xml`;

  function reset() {
    setFilter("all");
    setQuery("");
    setVisible(PAGE_SIZE);
  }

  const chip = (active: boolean) => ({
    flexShrink: 0,
    fontSize: 14,
    fontWeight: 500,
    color: active ? "#000" : "white",
    background: active ? "white" : "transparent",
    border: `1px solid ${active ? "white" : "#3D3D3D"}`,
    borderRadius: 100,
    padding: "0 16px",
    minHeight: 40,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
  }) as const;

  return (
    <div className="bl-type" style={{ fontFamily: FONT, background: "#000", minHeight: "100vh" }}>
      <section data-nav-theme="dark" style={{ background: "#000", color: "white", padding: "150px 24px 40px", position: "relative", overflow: "hidden" }}>
        <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "radial-gradient(60% 60% at 80% 0%, rgba(34,197,94,0.14) 0%, rgba(0,0,0,0) 70%)", pointerEvents: "none" }} />
        <div style={{ maxWidth: 1100, margin: "0 auto", position: "relative" }}>
          <div style={{ fontFamily: GT, fontSize: 12, letterSpacing: "0.18em", color: GREEN, textTransform: "uppercase", marginBottom: 18 }}>{t("eyebrow")}</div>
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE }}
            style={{ fontFamily: GT, fontSize: "clamp(48px, 13vw, 128px)", fontWeight: 400, letterSpacing: "0.02em", margin: 0, lineHeight: 1, textTransform: "uppercase" }}
          >
            {t("title")}
          </motion.h1>
          <p style={{ fontSize: 18, color: "rgba(255,255,255,0.6)", margin: "20px 0 0", maxWidth: 560, lineHeight: 1.5 }}>{t("subtitle")}</p>
        </div>
      </section>

      {posts.length > 0 ? (
        <section data-nav-theme="dark" style={{ background: "#000", padding: "8px 24px 120px" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>
            {/* Toolbar: search + sort + RSS */}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
              <label className="bl-search" style={{ flex: "1 1 260px", display: "flex", alignItems: "center", gap: 10, minHeight: 46, padding: "0 16px", borderRadius: 100, border: `1px solid ${BORDER}`, background: "#0A0A0A", color: "white" }}>
                <Search size={16} aria-hidden="true" style={{ color: SUBTLE, flexShrink: 0 }} />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setVisible(PAGE_SIZE); }}
                  placeholder={t("search_placeholder")}
                  aria-label={t("search_placeholder")}
                  style={{ flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none", color: "white", fontSize: 15 }}
                />
                {query && (
                  <button type="button" aria-label={t("clear_filters")} onClick={() => setQuery("")} style={{ background: "transparent", border: "none", color: SUBTLE, cursor: "pointer", display: "flex", padding: 4 }}>
                    <X size={16} aria-hidden="true" />
                  </button>
                )}
              </label>
              <div role="group" style={{ display: "flex", gap: 8 }}>
                {(["curated", "newest"] as const).map((s) => (
                  <button key={s} type="button" aria-pressed={sort === s} onClick={() => setSort(s)} className="bl-chip" style={chip(sort === s)}>
                    {t(`sort_${s}`)}
                  </button>
                ))}
              </div>
              <a href={rssHref} className="bl-chip" style={{ ...chip(false), textDecoration: "none", fontFamily: GT, fontSize: 12, letterSpacing: "0.08em" }}>
                <Rss size={14} aria-hidden="true" />
                {t("rss")}
              </a>
            </div>

            {/* Category chips */}
            <div className="no-scrollbar" style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 28 }}>
              <button type="button" aria-pressed={filter === "all"} onClick={() => { setFilter("all"); setVisible(PAGE_SIZE); }} className="bl-chip" style={chip(filter === "all")}>
                {t("filter_all")}
                <span style={{ fontFamily: GT, fontSize: 11, opacity: 0.7 }}>{posts.length}</span>
              </button>
              {categories.map((c) => (
                <button key={c.id} type="button" aria-pressed={filter === c.id} onClick={() => { setFilter(c.id); setVisible(PAGE_SIZE); }} className="bl-chip" style={chip(filter === c.id)}>
                  {label(c.id)}
                  <span style={{ fontFamily: GT, fontSize: 11, opacity: 0.7 }}>{c.count}</span>
                </button>
              ))}
            </div>

            <div aria-live="polite" style={{ fontSize: 13, color: SUBTLE, marginBottom: 24 }}>
              {isFiltering && t("results_count", { count: filtered.length })}
            </div>

            {feature && (
              <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE }} style={{ marginBottom: 56 }}>
                <Link href={`/blog/${feature.slug}`} className="bl-card bl-feature">
                  <Cover post={feature} index={0} sizes="(max-width: 860px) 100vw, 60vw" priority />
                  <div>
                    <span style={{ display: "inline-block", fontFamily: GT, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "#000", background: GREEN, borderRadius: 100, padding: "5px 12px", marginBottom: 16 }}>{t("featured")}</span>
                    <Meta post={feature} label={label} />
                    <h2 style={{ fontSize: "clamp(26px, 4vw, 40px)", fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.15, color: "white", margin: "14px 0 12px" }}>{feature.title}</h2>
                    {feature.excerpt && <p style={{ fontSize: 16, lineHeight: 1.6, color: "rgba(255,255,255,0.65)", margin: 0 }}>{feature.excerpt}</p>}
                  </div>
                </Link>
              </motion.div>
            )}

            {shown.length > 0 ? (
              <div style={{ display: "grid", gap: "40px 32px", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
                {shown.map((post, i) => (
                  <PostCard key={post.id} post={post} index={i + (feature ? 1 : 0)} label={label} />
                ))}
              </div>
            ) : (
              !feature && (
                <div style={{ textAlign: "center", padding: "56px 0", color: "white" }}>
                  <h2 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 8px" }}>{t("no_results")}</h2>
                  <p style={{ fontSize: 15, color: "rgba(255,255,255,0.6)", margin: "0 0 20px" }}>{t("no_results_hint")}</p>
                  <button type="button" onClick={reset} className="bl-chip" style={chip(false)}>{t("clear_filters")}</button>
                </div>
              )
            )}

            {rest.length > visible && (
              <div style={{ textAlign: "center", marginTop: 48 }}>
                <button type="button" onClick={() => setVisible((v) => v + PAGE_SIZE)} className="bl-chip" style={{ ...chip(false), minHeight: 48, padding: "0 28px", fontSize: 15 }}>
                  {t("load_more")}
                  <span style={{ fontFamily: GT, fontSize: 11, opacity: 0.7 }}>{rest.length - visible}</span>
                </button>
              </div>
            )}
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
    <section data-nav-theme="dark" style={{ background: "#000", color: "white", padding: "40px 24px 160px", textAlign: "center" }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <h2 style={{ fontSize: 28, fontWeight: 700, margin: "0 0 12px" }}>{t("coming_soon_title")}</h2>
        <p style={{ fontSize: 16, color: "rgba(255,255,255,0.6)", margin: 0 }}>{t("coming_soon_body")}</p>
      </div>
    </section>
  );
}
