import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import Nav from "@/components/layout/Nav";
import Footer from "@/components/layout/Footer";
import WhatsAppButton from "@/components/shared/WhatsAppButton";
import MembershipContent from "./MembershipContent";

const BASE = "https://space8.com.hk";

const META: Record<string, { title: string; description: string }> = {
  "zh-HK": {
    title: "會員制度｜SPACE8 積分等級",
    description:
      "SPACE8 會員制度：每消費 HK$1 累積 1 積分，三個等級 Amateur、Century、Maximum，自動升級，解鎖專屬福利。全預約制，網上預訂、QR碼自助入場。",
  },
  "zh-CN": {
    title: "会员制度｜SPACE8 积分等级",
    description:
      "SPACE8 会员制度：每消费 HK$1 累积 1 积分，三个等级 Amateur、Century、Maximum，自动升级，解锁专属福利。全预约制，网上预订、QR码自助入场。",
  },
  en: {
    title: "Membership｜SPACE8 Points & Tiers",
    description:
      "SPACE8 membership: earn 1 point per HK$1 spent across three tiers — Amateur, Century, Maximum — with automatic upgrades and exclusive benefits. Reservation-based — book online, self check-in via QR code.",
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const m = META[locale] ?? META["zh-HK"];
  const path = locale === "zh-HK" ? "/membership" : `/${locale}/membership`;

  return {
    title: m.title,
    description: m.description,
    alternates: {
      canonical: `${BASE}${path}`,
      languages: {
        "zh-HK": `${BASE}/membership`,
        "zh-CN": `${BASE}/zh-CN/membership`,
        en: `${BASE}/en/membership`,
        "x-default": `${BASE}/membership`,
      },
    },
    openGraph: {
      title: m.title,
      description: m.description,
      url: `${BASE}${path}`,
      siteName: "Space8",
      type: "website",
    },
    robots: { index: true, follow: true },
  };
}

export default async function MembershipPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main className="relative bg-black">
      <Nav />
      <MembershipContent />
      <Footer />
      <WhatsAppButton />
    </main>
  );
}
