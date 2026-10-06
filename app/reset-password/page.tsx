import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { resolveLocaleFromCookie, loadMessages } from "@/lib/i18n/serverLocale";
import { AmbientGlow } from "@/components/shared/AmbientGlow";
import ResetPasswordForm from "./ResetPasswordForm";

// Security page: never indexed, never sends the token-bearing URL as a
// referrer (Referrer-Policy is also set as a response header in next.config.js).
export const metadata: Metadata = {
  title: "Reset Password | Space8",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

export const dynamic = "force-dynamic";

// /reset-password is OUTSIDE the [locale] segment (bypassed by middleware), so
// the locale comes from the NEXT_LOCALE cookie — same pattern as /login.
//
// The token is deliberately NOT read here. The client reads it from the URL,
// strips it via history.replaceState, and only sends it on submit — so a mail
// scanner that prefetches this URL renders a form and consumes nothing.
export default async function ResetPasswordPage() {
  const locale = await resolveLocaleFromCookie();
  const messages = await loadMessages(locale);

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <main
        className="relative flex min-h-screen items-center justify-center bg-black px-4 py-24 text-white"
        style={{ isolation: "isolate" }}
      >
        <AmbientGlow />
        <ResetPasswordForm />
      </main>
    </NextIntlClientProvider>
  );
}
