import type { Metadata } from "next";
import { pageAlternates } from "@/lib/seo/site";
import { getTranslations, setRequestLocale } from "next-intl/server";
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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "memberIntro" });

  const title = t("meta.title");
  const description = t("meta.description");
  const path = locale === "zh-HK" ? "/membership" : `/${locale}/membership`;

  return {
    title,
    description,
    alternates: pageAlternates(locale, "/membership"),
    openGraph: {
      title,
      description,
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
