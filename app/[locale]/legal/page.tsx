import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import Nav from "@/components/layout/Nav";
import Footer from "@/components/layout/Footer";
import { getConfigValue } from "@/lib/data/getConfig";
import { getAllLegalDocuments, type LegalDocId } from "@/content/legal";
import type { Locale } from "@/i18n/routing";
import LegalContent from "./LegalContent";

const BASE = "https://space8.com.hk";

const DOC_IDS: LegalDocId[] = ["terms", "website_terms", "privacy", "accessibility"];

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
    alternates: {
      canonical: `${BASE}${path}`,
      languages: {
        "zh-HK": `${BASE}/legal`,
        "zh-CN": `${BASE}/zh-CN/legal`,
        en: `${BASE}/en/legal`,
        "x-default": `${BASE}/legal`,
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
  // This is booking/site CONFIG (see lib/data/getConfig.ts), not CMS page
  // copy — unrelated to the cms_content/cms_list_items tables this page no
  // longer reads from. See content/legal/index.ts for the actual document
  // text, which is now a static, build-time import (no runtime DB fetch).
  const legalCfg = await getConfigValue<{ updatedAt?: string }>("legal", {});
  const lastUpdated = legalCfg.updatedAt ?? "2026-07-14";

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
        }}
        documents={documents}
      />
      <Footer />
    </main>
  );
}
