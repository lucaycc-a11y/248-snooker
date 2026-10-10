import type { Metadata } from "next";
import { pageAlternates } from "@/lib/seo/site";
import { setRequestLocale, getTranslations } from "next-intl/server";
import Nav from "@/components/layout/Nav";
import Footer from "@/components/layout/Footer";
import { getAllLegalDocuments, type LegalDocId } from "@/content/legal";
import type { Locale } from "@/i18n/routing";
import LegalContent from "./LegalContent";

const BASE = "https://space8.com.hk";

// Effective/last-updated date for EVERY legal document tab (incl. privacy).
// Deliberately a code-level constant: the old `legal.updatedAt` config row
// (seeded 2026-06-29) is no longer read, so a stale DB value can never
// override the published date. Bump this when the legal text changes.
const LEGAL_UPDATED_AT = "2026-10-13";

const DOC_IDS: LegalDocId[] = ["terms", "website_terms", "privacy", "accessibility", "refund_policy", "delivery_policy", "brand_statement", "cookie_policy"];

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
  const docs = getAllLegalDocuments(locale as Locale);
  const rawSubtitle = (docs.terms.subtitle ?? "").replace(/^【重要提示】\n?/, "");
  const description =
    rawSubtitle.length > 155 ? `${rawSubtitle.slice(0, 155)}…` : rawSubtitle;

  return {
    title: `${t("page_title")} | Space8`,
    description,
    alternates: pageAlternates(locale, "/legal"),
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

  // See LEGAL_UPDATED_AT above — one date for all tabs, never from config.
  // Document text is a static build-time import (content/legal/index.ts).
  const lastUpdated = LEGAL_UPDATED_AT;

  const t = await getTranslations({ locale, namespace: "legal" });
  const documents = getAllLegalDocuments(locale as Locale);

  return (
    <main className="relative bg-white">
      <Nav />
      <LegalContent
        locale={locale as Locale}
        initialDoc={initialDoc}
        lastUpdated={lastUpdated}
        pageTitle={t("page_title")}
        lastUpdatedLabel={t("last_updated")}
        nav={{
          terms: t("nav.terms"),
          website_terms: t("nav.website_terms"),
          privacy: t("nav.privacy"),
          accessibility: t("nav.accessibility"),
          refund_policy: t("nav.refund_policy"),
          delivery_policy: t("nav.delivery_policy"),
          brand_statement: t("nav.brand_statement"),
          cookie_policy: t("nav.cookie_policy"),
        }}
        documents={documents}
      />
      <Footer />
    </main>
  );
}
