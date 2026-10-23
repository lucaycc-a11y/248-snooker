import type { Metadata } from "next";
import { indexingMeta } from "@/lib/env/app-env";
import { pageAlternates } from "@/lib/seo/site";
import { setRequestLocale, getTranslations } from "next-intl/server";
import dynamic from "next/dynamic";
import Nav from "@/components/layout/Nav";
import Footer from "@/components/layout/Footer";
import { getConfig } from "@/lib/data/getConfig";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { AmbientGlow } from "@/components/shared/AmbientGlow";
import { getFaqJsonLd, HOMEPAGE_FAQ_IDS } from "@/components/landing/faqData";
import { buildSportsClubJsonLd, safeJsonLd } from "@/lib/seo/jsonLd";
import NewMemberOfferNote from "@/components/seo/NewMemberOfferNote";
import { periodsToSlots } from "@/lib/ui/pricing-adapter";
import { MAP_QUERY } from "@/lib/site/nap";

// ── Critical above-the-fold components (eager load) ─────────────────────────
import Hero from "@/components/landing/Hero";
import HomeFacilitiesNew from "@/components/landing/HomeFacilitiesNew";

// ── Heavy animation components (lazy load with priority) ────────────────────
// SpacePilotScoreboardExperience uses framer-motion scroll animations
const SpacePilotScoreboardExperience = dynamic(
  () => import("@/components/landing/SpacePilotScoreboardExperience"),
  {
    ssr: true,
    loading: () => <div className="h-screen" /> // Preserve layout while loading
  }
);

// ── Below-the-fold components (lazy load) ───────────────────────────────────
const Section5BookingNew = dynamic(
  () => import("@/components/landing/Section5BookingNew"),
  { ssr: true }
);

const PricingCards = dynamic(
  () => import("@/components/ui/pricing-cards"),
  { ssr: true }
);

const MembershipNew = dynamic(
  () => import("@/components/landing/MembershipNew"),
  { ssr: true }
);

const HomeFAQ = dynamic(
  () => import("@/components/landing/HomeFAQ"),
  { ssr: true }
);

const HowToGo = dynamic(
  () => import("@/components/landing/HowToGo"),
  { ssr: true }
);

const ContactButton = dynamic(
  () => import("@/components/shared/ContactButton"),
  { ssr: false } // Client-only, no SSR needed
);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;

  const meta: Record<string, { title: string; description: string; keywords: string[]; ogDesc: string; canonical: string; ogLocale: string }> = {
    'zh-HK': {
      title: 'SPACE8｜香港中八桌球室｜新蒲崗自助無煙獨立球室',
      description: 'SPACE8 是香港新蒲崗自助無煙中八獨立球室，全預約制，網上預訂、QR碼自助入場。鄰近鑽石山及啟德港鐵站，九龍區中八愛好者主場。',
      keywords: ['中八', '中式八球', '中式桌球', '香港中八', '新蒲崗桌球', '鑽石山桌球', '九龍桌球', '自助桌球', '無煙桌球室'],
      ogDesc: '香港中八桌球室 · 新蒲崗自助無煙獨立球室 · 全預約制',
      canonical: 'https://space8.com.hk',
      ogLocale: 'zh_HK',
    },
    'zh-CN': {
      title: 'SPACE8｜香港中式八球台球室｜新蒲岗自助无烟独立球室',
      description: 'SPACE8 是香港新蒲岗自助无烟中式八球独立球室，全预约制，网上预订、QR码自助入场。邻近钻石山及启德港铁站，九龙区中式八球爱好者主场。',
      keywords: ['中式八球', '中八', '中式台球', '香港中式八球', '新蒲岗台球', '钻石山台球', '九龙台球', '自助台球', '无烟台球室'],
      ogDesc: '香港中式八球台球室 · 新蒲岗自助无烟独立球室 · 全预约制',
      canonical: 'https://space8.com.hk/zh-CN',
      ogLocale: 'zh_CN',
    },
    en: {
      title: 'SPACE8｜Hong Kong Chinese Eight-Ball Club｜Self-Service Private Rooms in San Po Kong',
      description: 'SPACE8 is a self-service, smoke-free Chinese eight-ball club in San Po Kong, Hong Kong. Reservation-based, book online with QR code check-in. Near Diamond Hill and Kai Tak MTR stations.',
      keywords: ['Chinese eight-ball', 'Chinese 8-ball pool', 'Chinese eight-ball Hong Kong', 'San Po Kong pool', 'Kowloon pool', 'self service pool', 'smoke-free pool room'],
      ogDesc: 'Hong Kong Chinese Eight-Ball Club · San Po Kong · Reservation-Based',
      canonical: 'https://space8.com.hk/en',
      ogLocale: 'en_HK',
    },
  }

  const m = meta[locale] ?? meta['zh-HK']

  return {
    title: m.title,
    description: m.description,
    keywords: m.keywords,
    openGraph: {
      // og:title must match the title text exactly — a bare brand name here
      // is what produced "No information is available for this page" on GSC.
      title: m.title,
      description: m.ogDesc,
      url: m.canonical,
      siteName: 'Space8',
      locale: m.ogLocale,
      type: 'website',
      images: [
        {
          url: 'https://space8.com.hk/images/og-image-中八桌球-香港新蒲崗.png',
          width: 1200,
          height: 630,
          alt: 'SPACE8 Club Hong Kong',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: m.title,
      description: m.ogDesc,
      images: ['https://space8.com.hk/images/og-image-中八桌球-香港新蒲崗.png'],
    },
    alternates: pageAlternates(locale, "/"),
    robots: indexingMeta(),
  };
}

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("pricingPage");
  const config = await getConfig();

  // Reorder periods: morning → afternoon → evening (explicit display order)
  const PERIOD_ORDER = ['morning', 'afternoon', 'evening'] as const;
  const orderedPeriods = PERIOD_ORDER
    .map(id => config.periods.find(p => p.id === id))
    .filter((p): p is NonNullable<typeof p> => p !== undefined);

  const slots = periodsToSlots(orderedPeriods, (key: string) => t(key));
  const sportsClubJsonLd = buildSportsClubJsonLd(locale, locale === "zh-HK" ? "/" : `/${locale}`, {
    periods: config.periods,
    openHour: config.openHour,
    closeHour: config.closeHour,
  });
  // FAQPage schema mirrors exactly the HomeFAQ subset rendered below.
  const tFaq = await getTranslations("faq");
  const faqJsonLd = getFaqJsonLd((key: string) => tFaq(key), HOMEPAGE_FAQ_IDS);

  const EMBED_URL = `https://maps.google.com/maps?q=${encodeURIComponent(MAP_QUERY)}&t=&z=17&ie=UTF8&iwloc=&output=embed`;

  return (
    <main className="relative bg-black" style={{ isolation: "isolate" }}>
      {/* SEO-only venue description: keep detailed search copy out of the visible hero. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(sportsClubJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(faqJsonLd) }}
      />
      <AmbientGlow />
      <Nav />
      <Hero />
      <section
        aria-labelledby="home-facilities-title"
        data-nav-theme="dark"
        className="overflow-x-clip bg-black px-0 py-24 md:py-32 pt-[calc(var(--nav-h,4rem)+3rem)] min-h-[100svh] flex flex-col justify-center"
      >
        <HomeFacilitiesNew />
      </section>
      <SpacePilotScoreboardExperience />
      <Section5BookingNew />

      <PricingCards
        theme="light"
        heading={t("periods_title")}
        subheading={t("periods_subtitle")}
        slots={slots}
      />
      <div style={{ background: "#fff", padding: "0 16px 32px" }}>
        <NewMemberOfferNote variant="banner" theme="light" />
      </div>

      {/* Learn More scroll target - zero-height anchor, sections flow directly */}
      <div id="social-proof" aria-hidden="true" />

      {/* Membership - last section before footer */}
      <ErrorBoundary sectionName="會員制度">
        <MembershipNew />
      </ErrorBoundary>

      {/* FAQ — above the footer. Homepage shows a curated 5-item subset with
          a "了解更多" link to the full /faq page. */}
      <HomeFAQ ids={HOMEPAGE_FAQ_IDS} moreHref="/faq" />

      <HowToGo theme="light" map={{ embedUrl: EMBED_URL }} />

      <Footer />

      {/* Floating contact CTA — mobile only. AI chat by default; becomes an
          AI-edit entry point when an admin has edit-mode on. */}
      <ContactButton />
    </main>
  );
}
