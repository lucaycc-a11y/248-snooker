import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import Nav from "@/components/layout/Nav";
import Footer from "@/components/layout/Footer";
import PilotIntro from "@/app/member/PilotIntro";
import { createClient } from "@/lib/supabase/server";
import { pageAlternates } from "@/lib/seo/site";
import { safeJsonLd } from "@/lib/seo/jsonLd";
import { SmoothScroll } from "@/components/ui/smooth-scroll";
import { PILOT_FAQ_IDS, SPACEPILOT_LAUNCH_AT, SPACEPILOT_PUBLIC, spacePilotLaunched } from "@/lib/seo/spacepilot";

// Beta: admin-only until Space Pilot opens to a small group of players.
// The check runs on the server so non-admins get a 404, not just a hidden link.
export const dynamic = "force-dynamic";

// SPACEPILOT_PUBLIC (lib/seo/spacepilot.ts): while false the page 404s for non-admins, is noindex
// and stays out of the sitemap.

const BASE = "https://space8.com.hk";

const SEO: Record<string, { title: string; description: string; keywords: string[]; home: string }> = {
  "zh-HK": {
    title: "Space Pilot 智能桌球計分｜SPACE8 新蒲崗獨家・會員免費",
    description:
      "Space Pilot 是 SPACE8 新蒲崗球室獨家的智能桌球計分系統：牆上 iPad 即時計分，支援中八、九球及團隊賽，自動記錄賽果並提供 AI 戰績分析。會員免費使用。",
    keywords: ["Space Pilot", "桌球計分", "九球計分", "智能桌球計分", "桌球計分 App", "自助桌球", "新蒲崗桌球", "中式八球", "桌球戰績", "AI 戰績分析", "輪流賽", "SPACE8"],
    home: "主頁",
  },
  "zh-CN": {
    title: "Space Pilot 智能台球计分｜SPACE8 新蒲岗独家・会员免费",
    description:
      "Space Pilot 是 SPACE8 新蒲岗球室独家的智能台球计分系统：墙上 iPad 实时计分，支持中八、九球及团队赛，自动记录赛果并提供 AI 战绩分析。会员免费使用。",
    keywords: ["Space Pilot", "台球计分", "九球计分", "智能台球计分", "自助台球", "新蒲岗台球", "中式八球", "台球战绩", "AI 战绩分析", "SPACE8"],
    home: "主页",
  },
  en: {
    title: "Space Pilot Smart Pool Scoring | Exclusive to SPACE8, Free for Members",
    description:
      "Space Pilot is SPACE8's exclusive smart pool scoring system in San Po Kong, Hong Kong: live scoring on a wall iPad for 8-ball, 9-ball and team matches, automatic results and AI match analysis. Free for members.",
    keywords: ["Space Pilot", "pool scoring app", "9-ball scoring", "smart scoreboard", "Chinese eight-ball", "self-service pool Hong Kong", "San Po Kong pool", "match stats", "AI match analysis", "SPACE8"],
    home: "Home",
  },
};

// Before launch the title and description carry the launch date; after 15 Dec 2026 they drop it (no deploy needed).
const PRELAUNCH: Record<string, { title: string; description: string }> = {
  "zh-HK": { title: "12 月 15 日推出｜", description: "2026 年 12 月 15 日正式推出。" },
  "zh-CN": { title: "12 月 15 日推出｜", description: "2026 年 12 月 15 日正式推出。" },
  en: { title: "Launching 15 Dec | ", description: "Launching 15 December 2026. " },
};

function seoFor(locale: string, launched: boolean) {
  const base = SEO[locale] ?? SEO["zh-HK"];
  if (launched) return base;
  const pre = PRELAUNCH[locale] ?? PRELAUNCH["zh-HK"];
  return { ...base, title: `${pre.title}${base.title}`, description: `${pre.description}${base.description}` };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const m = seoFor(locale, spacePilotLaunched());
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
  const launched = spacePilotLaunched();
  const m = seoFor(locale, launched);
  const t = await getTranslations({ locale, namespace: "memberPilotIntro" });
  const prefix = locale === "zh-HK" ? "" : `/${locale}`;
  const pageUrl = `${BASE}${prefix}/spacepilot`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        "@id": `${pageUrl}#app`,
        name: "Space Pilot",
        applicationCategory: "SportsApplication",
        operatingSystem: "iPadOS",
        description: m.description,
        url: pageUrl,
        inLanguage: locale,
        isAccessibleForFree: true,
        featureList: [t("f0Title"), t("f1Title"), t("f3Title"), t("cap3Title"), t("cap4Title")],
        provider: { "@type": "SportsActivityLocation", name: "SPACE8", url: BASE },
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "HKD",
          availability: launched ? "https://schema.org/InStock" : "https://schema.org/PreOrder",
          availabilityStarts: SPACEPILOT_LAUNCH_AT,
          description: launched ? "Free for SPACE8 members" : "Free for SPACE8 members. Launching 15 December 2026 (beta until then)",
        },
      },
      {
        "@type": "FAQPage",
        "@id": `${pageUrl}#faq`,
        inLanguage: locale,
        mainEntity: PILOT_FAQ_IDS.map((n) => ({
          "@type": "Question",
          name: t(`faq${n}q` as "faq1q"),
          acceptedAnswer: { "@type": "Answer", text: n === 2 && launched ? t("faq2aLaunched") : t(`faq${n}a` as "faq1a") },
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: m.home, item: `${BASE}${prefix}` },
          { "@type": "ListItem", position: 2, name: "Space Pilot", item: pageUrl },
        ],
      },
    ],
  };

  return (
    <main className="relative overflow-x-clip bg-black">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }} />
      <SmoothScroll />
      <Nav />
      <PilotIntro variant="page" launch={{ at: new Date(SPACEPILOT_LAUNCH_AT).getTime(), launched }} />
      <Footer />
    </main>
  );
}
