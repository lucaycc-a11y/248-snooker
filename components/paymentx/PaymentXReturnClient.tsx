"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useLocale } from "next-intl"
import { tokens } from "@/app/styles/tokens"

// PaymentX return page. Polls /api/paymentx/status (server → KPay) and shows what really
// happened. Customer-facing copy is written Chinese.

type State = "loading" | "confirmed" | "pending" | "needs_review" | "closed" | "unknown" | "none"
type StatusBody = {
  state?: State
  cashierUrl?: string | null
  reference?: { code?: string | null }
}

const POLL_MS = 2500
const SUPPORT_WHATSAPP = "85261808022"

const box = {
  maxWidth: 440,
  margin: "0 auto",
  padding: "48px 20px",
  color: tokens.colors.text,
  fontFamily: tokens.font.sans,
  textAlign: "center",
} as const

const primaryButton = {
  minHeight: 48,
  width: "100%",
  borderRadius: 14,
  border: "none",
  background: "#1a9d5c",
  color: "#fff",
  fontWeight: 600,
  fontSize: 15,
  cursor: "pointer",
} as const

const ghostButton = {
  minHeight: 48,
  width: "100%",
  borderRadius: 14,
  border: `1.5px solid ${tokens.colors.border}`,
  background: "transparent",
  color: tokens.colors.text,
  fontWeight: 600,
  fontSize: 15,
  cursor: "pointer",
} as const

export default function PaymentXReturnClient({ bookingId }: { bookingId: string }) {
  const locale = useLocale()
  const [state, setState] = useState<State>("loading")
  const [cashierUrl, setCashierUrl] = useState<string | null>(null)
  const [code, setCode] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const stopped = useRef(false)

  const bookHref = `/${locale}/book`
  const isMobile = typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)

  const poll = useCallback(async () => {
    if (!bookingId) return
    try {
      const res = await fetch(
        `/api/paymentx/status?bookingId=${encodeURIComponent(bookingId)}&mode=${isMobile ? "h5" : "web"}`,
        { cache: "no-store" },
      )
      if (res.status === 401) {
        window.location.href = `/${locale}/login?next=${encodeURIComponent(`/${locale}/book/paymentx?bookingId=${bookingId}`)}`
        stopped.current = true
        return
      }
      const body = (await res.json()) as StatusBody
      const next = body.state ?? "unknown"
      setState(next)
      setCashierUrl(body.cashierUrl ?? null)
      setCode(body.reference?.code ?? null)
      if (next === "confirmed") {
        stopped.current = true
        window.location.replace(`/${locale}/book?bookingId=${encodeURIComponent(bookingId)}&redirect_status=succeeded`)
      }
      if (next === "needs_review" || next === "closed" || next === "none") stopped.current = true
    } catch {
      /* keep polling; a single failed request is not an answer */
    }
  }, [bookingId, isMobile, locale])

  useEffect(() => {
    stopped.current = false
    void poll()
    const timer = setInterval(() => {
      if (!stopped.current) void poll()
    }, POLL_MS)
    return () => clearInterval(timer)
  }, [poll])

  async function cancel() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/paymentx/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId }),
      })
      if (res.status === 409) {
        // Paid in the meantime: show the real state instead.
        stopped.current = false
        await poll()
        return
      }
      if (!res.ok) {
        setError("暫時未能取消，請稍後再試。")
        return
      }
      window.location.href = bookHref
    } finally {
      setBusy(false)
    }
  }

  if (!bookingId) {
    return (
      <main style={box}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>找不到付款資料</h1>
        <p style={{ marginTop: 12, opacity: 0.7, fontSize: 14 }}>請返回預約頁重新操作。</p>
        <div style={{ marginTop: 24 }}>
          <button type="button" style={primaryButton} onClick={() => (window.location.href = bookHref)}>
            返回預約
          </button>
        </div>
      </main>
    )
  }

  if (state === "loading" || state === "confirmed") {
    return (
      <main style={box}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>{state === "confirmed" ? "付款成功" : "正在確認付款"}</h1>
        <p style={{ marginTop: 12, opacity: 0.7, fontSize: 14 }}>請稍候，系統正在向 KPay 核實付款結果…</p>
      </main>
    )
  }

  if (state === "needs_review") {
    return (
      <main style={box}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>已收到你的付款</h1>
        <p style={{ marginTop: 12, opacity: 0.8, fontSize: 14, lineHeight: 1.7 }}>
          你的付款已成功，但訂單需要我們人工核實。請保留下方參考資料，我們會盡快聯絡你，無須重複付款。
        </p>
        <div
          style={{ marginTop: 20, padding: 16, border: `1.5px solid ${tokens.colors.border}`, borderRadius: 16, textAlign: "left", fontSize: 14 }}
        >
          <div style={{ opacity: 0.6, fontSize: 12 }}>參考資料</div>
          <div style={{ marginTop: 6 }}>訂單編號　{code ?? "-"}</div>
        </div>
        <div style={{ marginTop: 20 }}>
          <a
            href={`https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(`你好，我的付款需要核實，訂單編號：${code ?? bookingId}`)}`}
            style={{ ...primaryButton, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}
          >
            WhatsApp 聯絡客服
          </a>
        </div>
      </main>
    )
  }

  if (state === "pending") {
    return (
      <main style={box}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>等待付款完成</h1>
        <p style={{ marginTop: 12, opacity: 0.8, fontSize: 14, lineHeight: 1.7 }}>
          尚未收到付款。如你已經付款，請稍候，系統會自動確認；如未付款，可以返回 KPay 付款頁繼續。
        </p>
        {error && <p style={{ marginTop: 12, color: "#e5484d", fontSize: 13 }}>{error}</p>}
        <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 12 }}>
          {cashierUrl && (
            <button type="button" style={primaryButton} onClick={() => (window.location.href = cashierUrl)}>
              繼續付款
            </button>
          )}
          <button type="button" style={ghostButton} disabled={busy} onClick={() => void cancel()}>
            {busy ? "處理中…" : "取消預訂"}
          </button>
        </div>
      </main>
    )
  }

  // closed / unknown / none
  return (
    <main style={box}>
      <h1 style={{ fontSize: 20, fontWeight: 700 }}>{state === "unknown" ? "暫時未能核實付款" : "付款未完成"}</h1>
      <p style={{ marginTop: 12, opacity: 0.8, fontSize: 14, lineHeight: 1.7 }}>
        {state === "unknown"
          ? "系統暫時未能向 KPay 查詢結果。如你已經付款，無須重複付款，請稍後重新整理本頁。"
          : "未收到付款，或付款頁已過期。你可以返回預約頁重新選擇時段。"}
      </p>
      <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 12 }}>
        {state === "unknown" && (
          <button type="button" style={primaryButton} onClick={() => void poll()}>
            重新查詢
          </button>
        )}
        <button type="button" style={state === "unknown" ? ghostButton : primaryButton} onClick={() => (window.location.href = bookHref)}>
          返回預約
        </button>
      </div>
    </main>
  )
}
