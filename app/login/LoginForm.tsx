"use client";

import { useRouter } from "next/navigation";
import { AuthCard } from "@/components/auth/AuthCard";

const GREEN = "#22c55e";

function safeReturnUrl(value: string): string {
  if (!value.startsWith("/")) return "/member";
  if (value.startsWith("//")) return "/member";
  return value;
}

// The /login page client island. Renders the shared AuthCard (single source of
// truth) inside a liquid-glass surface matching the landing page (black bg +
// translucent-white blur card). AuthCard self-resolves an existing session on
// mount and redirects via onAuthComplete, so a logged-in user never sees the form.
export default function LoginForm({
  returnUrl,
}: {
  returnUrl: string;
  error?: string | null;
}) {
  const router = useRouter();
  const safeUrl = safeReturnUrl(returnUrl);

  return (
    <section
      style={{
        width: "100%",
        maxWidth: 400,
        background: "rgba(255,255,255,0.05)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 24,
        padding: 40,
      }}
    >
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div
          data-cms-key="login.brand"
          style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.32em", color: GREEN, marginBottom: 12 }}
        >
          248 SNOOKER
        </div>
        <h1
          data-cms-key="login.title"
          style={{ fontFamily: '"Bebas Neue", sans-serif', fontSize: 34, letterSpacing: "0.02em", color: "#fff" }}
        >
          Sign In
        </h1>
      </div>

      <AuthCard returnUrl={safeUrl} onAuthComplete={() => router.replace(safeUrl)} />
    </section>
  );
}
