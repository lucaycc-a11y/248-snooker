import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { pageAlternates } from "@/lib/seo/site";

// /book/page.tsx is a Client Component and cannot export metadata, so the
// route's title, description and canonical live here. Checkout/confirm steps
// override robots with noindex in their own segments.
export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: "book" });
  return {
    title: t("meta_title"),
    description: t("meta_description"),
    alternates: pageAlternates(params.locale, "/book"),
    robots: { index: true, follow: true },
  };
}

export default function BookLayout({ children }: { children: React.ReactNode }) {
  return children;
}
