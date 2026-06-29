"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn, MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://248.formhk.com";

function safeReturnUrl(value: string): string {
  if (!value.startsWith("/")) return "/member";
  if (value.startsWith("//")) return "/member";
  return value;
}

export default function LoginForm({
  returnUrl,
  error,
}: {
  returnUrl: string;
  error: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<"google" | "whatsapp" | null>(null);
  const [localError, setLocalError] = useState<string | null>(error);
  const safeUrl = safeReturnUrl(returnUrl);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace(safeUrl);
    });
  }, [router, safeUrl]);

  const signInWithGoogle = async () => {
    setLoading("google");
    setLocalError(null);

    const supabase = createClient();
    const redirectTo = `${SITE_URL}/auth/callback?next=${encodeURIComponent(safeUrl)}`;
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });

    if (oauthError) {
      setLocalError(oauthError.message);
      setLoading(null);
    }
  };

  const signInWithWhatsApp = () => {
    setLoading("whatsapp");
    router.push(`/login/whatsapp?returnUrl=${encodeURIComponent(safeUrl)}`);
  };

  return (
    <section className="w-full max-w-md rounded-[28px] border border-white/10 bg-zinc-950 p-6 sm:p-8">
      <div className="mb-8 text-center">
        <div data-cms-key="login.brand" className="mb-4 text-[14px] font-semibold tracking-[0.32em] text-white/45">
          248 SNOOKER
        </div>
        <h1 data-cms-key="login.title" className="text-3xl font-bold tracking-[-0.03em]">
          Sign in to continue
        </h1>
        <p data-cms-key="login.subtitle" className="mt-3 text-sm leading-relaxed text-white/55">
          Your booking and membership are saved. Sign in to complete payment and access your member area.
        </p>
        {localError ? (
          <p data-cms-key="login.error" className="mt-4 rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            Sign-in failed. Please try again.
          </p>
        ) : null}
      </div>

      <div className="space-y-3">
        <button
          type="button"
          onClick={signInWithGoogle}
          disabled={loading !== null}
          className="flex w-full min-h-11 items-center justify-center gap-3 rounded-full bg-white px-5 py-3 font-medium text-black transition active:scale-95 disabled:opacity-70"
          data-cms-key="login.google"
        >
          <LogIn size={18} strokeWidth={1.7} />
          {loading === "google" ? "Connecting..." : "Continue with Google"}
        </button>

        <button
          type="button"
          onClick={signInWithWhatsApp}
          disabled={loading !== null}
          className="flex w-full min-h-11 items-center justify-center gap-3 rounded-full border border-white/10 bg-white/5 px-5 py-3 font-medium text-white transition active:scale-95 disabled:opacity-70"
          data-cms-key="login.whatsapp"
        >
          <MessageCircle size={18} strokeWidth={1.7} />
          {loading === "whatsapp" ? "Opening..." : "Continue with WhatsApp"}
        </button>
      </div>

      <p data-cms-key="login.terms" className="mt-6 text-center text-xs leading-relaxed text-white/40">
        By continuing, you agree to our Terms and Privacy Policy.
      </p>
    </section>
  );
}
