"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AuthCard } from "@/components/auth/AuthCard";

const GREEN = "#22c55e";

function safeReturnUrl(value: string): string {
  if (!value.startsWith("/")) return "/member";
  if (value.startsWith("//")) return "/member";
  return value;
}

// Map a callback ?error= code to its CMS message key. The /auth/callback route
// emits 'missing_code' (no code in the redirect) and 'oauth' (exchange failed).
function errorKey(error: string | null): string | null {
  if (!error) return null;
  if (error === "missing_code") return "error_missing_code";
  if (error === "oauth") return "error_oauth";
  return "error_generic";
}

// The /login page client island. Renders the shared AuthCard (single source of
// truth) inside a liquid-glass surface matching the landing page (black bg +
// translucent-white blur card). AuthCard self-resolves an existing session on
// mount and redirects via onAuthComplete, so a logged-in user never sees the form.
export default function LoginForm({
  returnUrl,
  error = null,
}: {
  returnUrl: string;
  error?: string | null;
}) {
  const router = useRouter();
  const t = useTranslations("login");
  const safeUrl = safeReturnUrl(returnUrl);
  const errKey = errorKey(error);

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
          {t("brand")}
        </div>
        <h1
          data-cms-key="login.title"
          style={{ fontFamily: '"Bebas Neue", sans-serif', fontSize: 34, letterSpacing: "0.02em", color: "#fff" }}
        >
          {t("title")}
        </h1>
      </div>

      {errKey && (
        <div
          role="alert"
          data-cms-key={`login.${errKey}`}
          style={{
            marginBottom: 20,
            padding: "10px 14px",
            borderRadius: 12,
            background: "rgba(248,113,113,0.1)",
            border: "1px solid rgba(248,113,113,0.3)",
            color: "#f87171",
            fontSize: 13,
            textAlign: "center",
          }}
        >
          {t(errKey)}
        </div>
      )}

      <AuthCard returnUrl={safeUrl} onAuthComplete={() => router.replace(safeUrl)} />
    </section>
  );
}

