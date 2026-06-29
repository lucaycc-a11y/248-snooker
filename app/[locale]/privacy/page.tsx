import { redirect } from "next/navigation";

// /privacy is kept as a stable, link-/SEO-friendly URL (the Footer links here).
// The actual content lives in the tabbed /legal page. We build the locale path
// manually (as-needed prefix: none for the default zh-HK) so this never depends
// on a specific next-intl redirect signature.
export default async function PrivacyRedirect({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const prefix = locale === "zh-HK" ? "" : `/${locale}`;
  redirect(`${prefix}/legal?tab=privacy`);
}
