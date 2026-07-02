import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { resolveLocaleFromCookie, loadMessages } from "@/lib/i18n/serverLocale";
import LoginForm from "./LoginForm";

const BASE = "https://248.formhk.com";

export const metadata: Metadata = {
  title: "Login | Space8",
  description: "Sign in to continue your booking and member access.",
  alternates: { canonical: `${BASE}/login` },
  openGraph: {
    title: "Login | Space8",
    description: "Sign in to continue your booking and member access.",
    url: `${BASE}/login`,
    siteName: "Space8",
    type: "website",
  },
};

// Reads auth state on mount (client) — never prerender.
export const dynamic = "force-dynamic";

function safeReturnUrl(value: string | null): string {
  if (!value) return "/member";
  if (!value.startsWith("/")) return "/member";
  if (value.startsWith("//")) return "/member";
  return value;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const returnUrlParam = params.returnUrl;
  const errorParam = params.error;
  const returnUrl = safeReturnUrl(Array.isArray(returnUrlParam) ? returnUrlParam[0] : returnUrlParam ?? null);
  const error = Array.isArray(errorParam) ? errorParam[0] ?? null : errorParam ?? null;

  // /login lives OUTSIDE the [locale] segment (bypassed by middleware), so the
  // intl request locale is never set. Resolve it from the NEXT_LOCALE cookie and
  // provide messages here — WITHOUT this provider, AuthCard's useTranslations
  // throws on render, which is what produced the React #425/#422 + "TRY AGAIN"
  // crash on /login (and on the OAuth-failure redirect to /login?error=...).
  const locale = await resolveLocaleFromCookie();
  const messages = await loadMessages(locale);

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <main className="flex min-h-screen items-center justify-center bg-black px-4 py-24 text-white">
        <LoginForm returnUrl={returnUrl} error={error} />
      </main>
    </NextIntlClientProvider>
  );
}
