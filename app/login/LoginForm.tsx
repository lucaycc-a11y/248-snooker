"use client";

import { useRouter } from "next/navigation";
import { AuthCard } from "@/components/auth/AuthCard";

const DEEP = "#0a1a0f";
const BRASS = "#c9a876";

function safeReturnUrl(value: string): string {
  if (!value.startsWith("/")) return "/member";
  if (value.startsWith("//")) return "/member";
  return value;
}

// The /login page client island. Renders the shared AuthCard (single source of
// truth) inside the elevated "members' club" surface: deep green + a single brass
// hairline, no shadow. AuthCard self-resolves an existing session on mount and
// redirects via onAuthComplete, so an already-logged-in user never sees the form.
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
        background: DEEP,
        border: `1px solid ${BRASS}`,
        borderRadius: 20,
        padding: 40,
      }}
    >
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div
          data-cms-key="login.brand"
          style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.32em", color: BRASS, marginBottom: 12 }}
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
