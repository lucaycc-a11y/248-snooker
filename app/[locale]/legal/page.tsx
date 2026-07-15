import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import Nav from "@/components/layout/Nav";
import Footer from "@/components/layout/Footer";
import { getConfigValue } from "@/lib/data/getConfig";
import { getLegalSections, type LegalCollectionKey } from "@/lib/data/getLegalData";
import LegalContent, { type LegalDocId } from "./LegalContent";

const BASE = "https://space8.com.hk";

const DOC_IDS: LegalDocId[] = ["terms", "website_terms", "privacy"];

function resolveDocId(raw: string | undefined): LegalDocId {
  return (DOC_IDS as string[]).includes(raw ?? "") ? (raw as LegalDocId) : "terms";
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal" });
  const path = locale === "zh-HK" ? "/legal" : `/${locale}/legal`;
  // SEO meta description only — truncated for length. The full verbatim
  // subtitle/intro text of each document is rendered unabridged on the page.
  const rawSubtitle = t("terms.subtitle").replace(/^【重要提示】\n?/, "");
  const description =
    rawSubtitle.length > 155 ? `${rawSubtitle.slice(0, 155)}…` : rawSubtitle;

  return {
    title: `${t("page_title")} | Space8`,
    description,
    alternates: {
      canonical: `${BASE}${path}`,
      languages: {
        "zh-HK": `${BASE}/legal`,
        "zh-CN": `${BASE}/zh-CN/legal`,
        en: `${BASE}/en/legal`,
      },
    },
    openGraph: {
      title: `${t("page_title")} | Space8`,
      description,
      url: `${BASE}${path}`,
      siteName: "Space8",
      type: "website",
    },
    robots: { index: true, follow: true },
  };
}

export default async function LegalPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ doc?: string }>;
}) {
  const { locale } = await params;
  const { doc } = await searchParams;
  setRequestLocale(locale);

  const initialDoc = resolveDocId(doc);

  // Last-updated date is editable from the config table (key: legal.updatedAt).
  const legalCfg = await getConfigValue<{ updatedAt?: string }>("legal", {});
  const lastUpdated = legalCfg.updatedAt ?? "2026-07-14";

  const t = await getTranslations({ locale, namespace: "legal" });

  const termsFallback = t.raw("terms.sections") as { title: string; body: string }[];
  const websiteTermsFallback = t.raw("website_terms.sections") as { title: string; body: string }[];
  const privacyFallback = t.raw("privacy.sections") as { title: string; body: string }[];

  const fetchSections = (collectionKey: LegalCollectionKey, fallback: { title: string; body: string }[]) =>
    getLegalSections("legal", collectionKey, locale, fallback);

  const [termsSections, websiteTermsSections, privacySections] = await Promise.all([
    fetchSections("terms_sections", termsFallback),
    fetchSections("website_terms_sections", websiteTermsFallback),
    fetchSections("privacy_sections", privacyFallback),
  ]);

  return (
    <main className="relative bg-white">
      <Nav />
      <LegalContent
        initialDoc={initialDoc}
        lastUpdated={lastUpdated}
        termsSections={termsSections}
        websiteTermsSections={websiteTermsSections}
        privacySections={privacySections}
      />
      <Footer />
    </main>
  );
}
