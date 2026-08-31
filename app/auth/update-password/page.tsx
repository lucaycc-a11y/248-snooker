import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { resolveLocaleFromCookie, loadMessages } from "@/lib/i18n/serverLocale";
import { AmbientGlow } from "@/components/shared/AmbientGlow";
import UpdatePasswordForm from "./UpdatePasswordForm";

const BASE = "https://space8.com.hk";

export const metadata: Metadata = {
  title: "Update Password | Space8",
  description: "Set a new password for your Space8 account.",
  alternates: { canonical: `${BASE}/auth/update-password` },
  openGraph: {
    title: "Update Password | Space8",
    description: "Set a new password for your Space8 account.",
    url: `${BASE}/auth/update-password`,
    siteName: "Space8",
    type: "website",
  },
};

// Reads the recovery token + exchanges it for a session on mount (client) —
// never prerender.
export const dynamic = "force-dynamic";

// /auth is OUTSIDE the [locale] segment (bypassed by middleware), so the intl
// request locale is never set. Resolve it from the NEXT_LOCALE cookie and
// provide messages here — WITHOUT this provider, UpdatePasswordForm's
// useTranslations throws on render (the same React #425/#422 crash that
// previously hit /login).
export default async function UpdatePasswordPage() {
  const locale = await resolveLocaleFromCookie();
  const messages = await loadMessages(locale);

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <main
        className="relative flex min-h-screen items-center justify-center bg-black px-4 py-24 text-white"
        style={{ isolation: "isolate" }}
      >
        <AmbientGlow />
        <UpdatePasswordForm />
      </main>
    </NextIntlClientProvider>
  );
}
