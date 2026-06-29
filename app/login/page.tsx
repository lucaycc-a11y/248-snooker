import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import LoginForm from "./LoginForm";

const BASE = "https://248.formhk.com";

export const metadata: Metadata = {
  title: "Login | 248 Snooker",
  description: "Sign in to continue your booking and member access.",
  alternates: { canonical: `${BASE}/login` },
  openGraph: {
    title: "Login | 248 Snooker",
    description: "Sign in to continue your booking and member access.",
    url: `${BASE}/login`,
    siteName: "248 Snooker",
    type: "website",
  },
};

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
  const localeCookie = (await cookies()).get("NEXT_LOCALE")?.value;
  await getTranslations({ locale: localeCookie ?? "zh-HK", namespace: "login" }).catch(() => null);

  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-4 py-24 text-white">
      <LoginForm returnUrl={returnUrl} error={error} />
    </main>
  );
}
