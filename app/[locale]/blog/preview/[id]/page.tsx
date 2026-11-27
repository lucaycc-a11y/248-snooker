import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import Nav from "@/components/layout/Nav";
import Footer from "@/components/layout/Footer";
import { SmoothScroll } from "@/components/ui/smooth-scroll";
import { getAdminData } from "@/lib/data/getAdmin";
import { getServiceSupabase } from "@/lib/supabase/service";
import { getRelatedPosts, type BlogPost } from "@/lib/data/getBlog";
import BlogArticleContent from "../../[slug]/BlogArticleContent";

// Admin-only draft preview: renders the real public article layout for any post (draft, scheduled or live),
// by id, so editors see exactly what readers will see. Never indexed; non-admins get a 404.
export const dynamic = "force-dynamic";

const BASE = "https://space8.com.hk";

export const metadata: Metadata = {
  title: "Preview",
  robots: { index: false, follow: false },
};

export default async function BlogPreviewPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const admin = await getAdminData();
  if (!admin) notFound();

  const service = getServiceSupabase();
  const { data } = await service.from("blog_posts").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const post = data as unknown as BlogPost;

  const related = await getRelatedPosts(post);
  const prefix = post.locale === "zh-HK" ? "" : `/${post.locale}`;
  const url = `${BASE}${prefix}/blog/${post.slug}`;
  const state = !post.published_at ? "草稿" : new Date(post.published_at).getTime() > Date.now() ? "已排程" : "已發佈";

  return (
    <main className="relative bg-black">
      <SmoothScroll />
      <Nav />
      <BlogArticleContent post={post} related={related} locale={locale} url={url} />
      <Footer />
      <div
        style={{
          position: "fixed", left: "50%", bottom: 16, transform: "translateX(-50%)", zIndex: 80,
          display: "inline-flex", alignItems: "center", gap: 10, padding: "8px 16px", borderRadius: 999,
          background: "rgba(20,20,22,0.82)", backdropFilter: "blur(18px) saturate(180%)", WebkitBackdropFilter: "blur(18px) saturate(180%)",
          border: "1px solid rgba(255,255,255,0.14)", color: "#f5f5f7", fontSize: 12, letterSpacing: "0.04em", pointerEvents: "none",
        }}
      >
        <span style={{ fontFamily: "'Good Times', 'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.16em", color: "#22C55E" }}>PREVIEW</span>
        <span>{state} · 只有管理員看得到</span>
      </div>
    </main>
  );
}
