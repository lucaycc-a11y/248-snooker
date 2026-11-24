import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import Nav from "@/components/layout/Nav";
import Footer from "@/components/layout/Footer";
import PilotIntro from "@/app/member/PilotIntro";
import { createClient } from "@/lib/supabase/server";
import { pageAlternates } from "@/lib/seo/site";
import { safeJsonLd } from "@/lib/seo/jsonLd";

// Beta: admin-only until Space Pilot opens to a small group of players.
// The check runs on the server so non-admins get a 404, not just a hidden link.
export const dynamic = "force-dynamic";

// Flip to true when Space Pilot opens to the public (and remove the admin check below).
// Until then the page 404s for non-admins, so it stays out of search results.
const SPACEPILOT_PUBLIC = false;

const BASE = "https://space8.com.hk";

const SEO: Record<string, { title: string; description: string; keywords: string[] }> = {
  "zh-HK": {
    title: "Space Pilot｜SPACE8 獨家桌球智能計分系統，會員免費使用",
    description:
      "Space Pilot 係 SPACE8 獨家嘅桌球智能計分系統：牆上 iPad 即時計分、自動記錄賽果、賽後房內錄影同戰績分析。只限 SPACE8 新蒲崗球室，會員免費使用。",
    keywords: ["Space Pilot", "桌球計分", "智能計分", "SPACE8", "新蒲崗桌球", "中式八球", "桌球錄影", "會員免費"],
  },
  "zh-CN": {
    title: "Space Pilot｜SPACE8 独家台球智能计分系统，会员免费使用",
    description:
      "Space Pilot 是 SPACE8 独家的台球智能计分系统：墙上 iPad 实时计分、自动记录赛果、赛后房内录像与战绩分析。仅限 SPACE8 新蒲岗球室，会员免费使用。",
    keywords: ["Space Pilot", "台球计分", "智能计分", "SPACE8", "新蒲岗台球", "中式八球", "会员免费"],
  },
  en: {
    title: "Space Pilot｜Smart Pool Scoring, Exclusive to SPACE8 — Free for Members",
    description:
      "Space Pilot is SPACE8's exclusive smart scoring system: a wall-mounted iPad keeps live score, records every result, and gives you in-room replays and stats. Only at SPACE8 San Po Kong, free for members.",
    keywords: ["Space Pilot", "pool scoring", "smart scoreboard", "SPACE8", "San Po Kong", "Chinese eight-ball", "free for members"],
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const m = SEO[locale] ?? SEO["zh-HK"];
  const path = locale === "zh-HK" ? "/spacepilot" : `/${locale}/spacepilot`;
  return {
    title: m.title,
    description: m.description,
    keywords: m.keywords,
    alternates: pageAlternates(locale, "/spacepilot"),
    openGraph: { title: m.title, description: m.description, url: `${BASE}${path}`, siteName: "Space8", type: "website" },
    twitter: { card: "summary_large_image", title: m.title, description: m.description },
    robots: SPACEPILOT_PUBLIC ? { index: true, follow: true } : { index: false, follow: false },
  };
}

async function isActiveAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase
    .from("admin_users")
    .select("is_active")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();
  return !!data;
}

export default async function SpacePilotPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (!SPACEPILOT_PUBLIC && !(await isActiveAdmin())) notFound();
  const m = SEO[locale] ?? SEO["zh-HK"];
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Space Pilot",
    applicationCategory: "SportsApplication",
    description: m.description,
    url: `${BASE}${locale === "zh-HK" ? "" : `/${locale}`}/spacepilot`,
    provider: { "@type": "SportsActivityLocation", name: "SPACE8", url: BASE },
    offers: { "@type": "Offer", price: "0", priceCurrency: "HKD", description: "Free for SPACE8 members" },
  };

  return (
    <main className="relative overflow-x-clip bg-black">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }} />
      <Nav />
      <PilotIntro variant="page" />
      <Footer />
    </main>
  );
}
