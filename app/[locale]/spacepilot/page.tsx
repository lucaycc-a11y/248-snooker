import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import Nav from "@/components/layout/Nav";
import Footer from "@/components/layout/Footer";
import PilotIntro from "@/app/member/PilotIntro";
import { createClient } from "@/lib/supabase/server";
import { pageAlternates } from "@/lib/seo/site";
import { safeJsonLd } from "@/lib/seo/jsonLd";
import { PILOT_FAQ_IDS, SPACEPILOT_PUBLIC } from "@/lib/seo/spacepilot";

// Beta: admin-only until Space Pilot opens to a small group of players.
// The check runs on the server so non-admins get a 404, not just a hidden link.
export const dynamic = "force-dynamic";

// SPACEPILOT_PUBLIC (lib/seo/spacepilot.ts): while false the page 404s for non-admins, is noindex
// and stays out of the sitemap.

const BASE = "https://space8.com.hk";

const SEO: Record<string, { title: string; description: string; keywords: string[]; home: string }> = {
  "zh-HK": {
    title: "Space Pilot 智能桌球計分 Beta｜SPACE8 新蒲崗獨家・會員免費",
    description:
      "Space Pilot 是 SPACE8 新蒲崗球室獨家的智能桌球計分系統：牆上 iPad 即時計分、自動記錄賽果，賽後整理戰績並提供 AI 分析。會員免費使用。",
    keywords: ["Space Pilot", "桌球計分", "智能桌球計分", "桌球計分 App", "自助桌球", "新蒲崗桌球", "中式八球", "桌球戰績", "AI 戰績分析", "輪流賽", "SPACE8"],
    home: "主頁",
  },
  "zh-CN": {
    title: "Space Pilot 智能台球计分 Beta｜SPACE8 新蒲岗独家・会员免费",
    description:
      "Space Pilot 是 SPACE8 新蒲岗球室独家的智能台球计分系统：墙上 iPad 实时计分、自动记录赛果，赛后整理战绩并提供 AI 分析。会员免费使用。",
    keywords: ["Space Pilot", "台球计分", "智能台球计分", "自助台球", "新蒲岗台球", "中式八球", "台球战绩", "AI 战绩分析", "SPACE8"],
    home: "主页",
  },
  en: {
    title: "Space Pilot Smart Pool Scoring (Beta) | Exclusive to SPACE8, Free for Members",
    description:
      "Space Pilot is SPACE8's exclusive smart pool scoring system in San Po Kong, Hong Kong: live scoring on a wall iPad, automatic results, in-room replays and AI match analysis. Free for members.",
    keywords: ["Space Pilot", "pool scoring app", "smart scoreboard", "Chinese eight-ball", "self-service pool Hong Kong", "San Po Kong pool", "match stats", "AI match analysis", "SPACE8"],
    home: "Home",
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
        featureList: [t("f1Title"), t("f3Title"), t("cap3Title"), t("cap4Title")],
        provider: { "@type": "SportsActivityLocation", name: "SPACE8", url: BASE },
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "HKD",
          availability: "https://schema.org/LimitedAvailability",
          description: "Free for SPACE8 members (beta, limited players)",
        },
      },
      {
        "@type": "FAQPage",
        "@id": `${pageUrl}#faq`,
        inLanguage: locale,
        mainEntity: PILOT_FAQ_IDS.map((n) => ({
          "@type": "Question",
          name: t(`faq${n}q` as "faq1q"),
          acceptedAnswer: { "@type": "Answer", text: t(`faq${n}a` as "faq1a") },
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
      <Nav />
      <PilotIntro variant="page" />
      <Footer />
    </main>
  );
}
