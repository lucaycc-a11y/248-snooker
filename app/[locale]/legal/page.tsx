import type { Metadata } from "next";
import { indexingMeta } from "@/lib/env/app-env";
import { pageAlternates } from "@/lib/seo/site";
import { setRequestLocale, getTranslations } from "next-intl/server";
import Nav from "@/components/layout/Nav";
import Footer from "@/components/layout/Footer";
import { getAllLegalDocuments, type LegalDocId } from "@/content/legal";
import type { Locale } from "@/i18n/routing";
import LegalContent from "./LegalContent";
import { getActivePricingV2 } from "@/lib/pricing-v2";

const BASE = "https://space8.com.hk";

// Effective/last-updated date for EVERY legal document tab (incl. privacy).
// Deliberately a code-level constant: the old `legal.updatedAt` config row
// (seeded 2026-06-29) is no longer read, so a stale DB value can never
// override the published date. Bump this when the legal text changes.
const LEGAL_UPDATED_AT = "2026-10-21";

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
    robots: indexingMeta(),
  };
}

export default async function LegalPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ doc?: string; tab?: string }>;
}) {
  const { locale } = await params;
  const { doc: docParam, tab } = await searchParams;
  const doc = docParam ?? tab;
  setRequestLocale(locale);

  const initialDoc = resolveDocId(doc);

  // See LEGAL_UPDATED_AT above — one date for all tabs, never from config.
  // Document text is a static build-time import (content/legal/index.ts).
  const lastUpdated = LEGAL_UPDATED_AT;

  const t = await getTranslations({ locale, namespace: "legal" });
  const documents = getAllLegalDocuments(locale as Locale);

  // 連訂 clause: appended (not inserted) so existing 第0X條 cross-references keep
  // their numbers. Only shown while pricing v2 applies to the viewer.
  if (await getActivePricingV2()) {
    const rates = (await getActivePricingV2())!;
    documents.terms = {
      ...documents.terms,
      sections: [
        ...documents.terms.sections,
        {
          title: "連訂價錢計算",
          body: [
            `連訂定義： 於同一天連續預訂 ${rates.comboMinHours} 小時或以上，該預訂內每個小時均按所屬時段之連訂價計算；連訂優惠僅適用於同一天的預訂。`,
            `跨時段計算： 跨時段預訂會按各時段的連訂價計算。例如預訂 16:00–20:00：下午連訂價 × 2 + 黃金連訂價 × 2。`,
            `適用範圍： 不足 ${rates.comboMinHours} 小時之預訂，或分別於不同日期作出之預訂，不適用連訂價，按各時段原價計算。現行連訂價及原價以預約頁面及價目表所示為準。`,
          ].join("\n"),
        },
      ],
    };
  }

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
