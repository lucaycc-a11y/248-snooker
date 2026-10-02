import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import dynamic from "next/dynamic";
import Nav from "@/components/layout/Nav";
import Footer from "@/components/layout/Footer";

// ── Main content (lazy load) ────────────────────────────────────────────────
const MembershipContent = dynamic(
  () => import("./MembershipContent"),
  { ssr: true }
);

const WhatsAppButton = dynamic(
  () => import("@/components/shared/WhatsAppButton"),
  { ssr: false } // Client-only
);

const BASE = "https://space8.com.hk";

const META: Record<string, { title: string; description: string }> = {
  "zh-HK": {
    title: "會員 · SPACE8",
    description:
      "SPACE8 會員：每消費 HK$1 累積 1 積分，100 積分 = HK$10 場地抵用額。新會員即享 100 積分迎新獎賞。全預約制，QR 碼自助入場，安全可靠。",
  },
  "zh-CN": {
    title: "会员 · SPACE8",
    description:
      "SPACE8 会员：每消费 HK$1 累积 1 积分，100 积分 = HK$10 场地抵用额。新会员即享 100 积分迎新奖赏。全预约制，QR 码自助入场，安全可靠。",
  },
  en: {
    title: "Membership · SPACE8",
    description:
      "SPACE8 membership: earn 1 point per HK$1, 100 points = HK$10 venue credit. New members get 100 points welcome bonus. Reservation-based, QR self check-in, safe & secure.",
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
    <main className="relative bg-black overflow-x-hidden">
      <Nav />
      <MembershipContent />
      <Footer />
      <WhatsAppButton />
    </main>
  );
}
