import type { Metadata } from "next"
import { Suspense } from "react"
import AdminLoginForm from "./AdminLoginForm"

export const metadata: Metadata = {
  title: "Admin Login | Space8",
  description: "Space8 管理員登入",
}

export const dynamic = "force-dynamic"

export default function AdminLoginPage() {
  return (
    <main
      style={{
        display: "flex",
        minHeight: "100vh",
        alignItems: "center",
        justifyContent: "center",
        background: "#000",
        padding: "24px 16px",
      }}
    >
      {/* Decorative ambient elements */}
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          translate: "-50% -50%",
          width: "75vw",
          height: "75vw",
          maxWidth: 700,
          maxHeight: 700,
          borderRadius: "50%",
          background:
            "radial-gradient(circle at 30% 40%, rgba(34,184,107,0.08) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "fixed",
          top: "20%",
          right: "10%",
          width: 300,
          height: 300,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(34,184,107,0.04) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      {/* Login card */}
      <div
        className="glass-panel"
        style={{
          width: "100%",
          maxWidth: 400,
          padding: 40,
          position: "relative",
          zIndex: 1,
        }}
      >
        <Suspense
          fallback={
            <div style={{ textAlign: "center", padding: 32 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  border: "2px solid rgba(255,255,255,0.1)",
                  borderTopColor: GREEN,
                  animation: "space8-spin 1.4s linear infinite",
                  margin: "0 auto",
                }}
              />
            </div>
          }
        >
          <AdminLoginForm />
        </Suspense>
      </div>
    </main>
  )
}

const GREEN = "#22b86b"