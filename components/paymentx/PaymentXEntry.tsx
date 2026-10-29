"use client"

import { useEffect, useState } from "react"
import { useLocale } from "next-intl"
import { tokens } from "@/app/styles/tokens"

// PaymentX entry on the checkout payment-method step. Renders NOTHING unless the signed-in
// account is on the admin-selected test list (/api/paymentx/eligible), so every other
// customer sees the checkout exactly as before.

type Block = { date: string; startHour: number; duration: number; tableNumber: 1 | 2 }

type Props = {
  blocks: Block[]
  useWallet: boolean
  promoCode: string | null
  agreedToTerms: boolean
  onTermsRequired: () => void
}

function isDesktopDevice(): boolean {
  const ua = navigator.userAgent
  const mobileUa = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua)
  const touchMac = /Macintosh/i.test(ua) && navigator.maxTouchPoints > 1
  return !mobileUa && !touchMac
}

export default function PaymentXEntry({ blocks, useWallet, promoCode, agreedToTerms, onTermsRequired }: Props) {
  const locale = useLocale()
  const [eligible, setEligible] = useState(false)
  const [version, setVersion] = useState("X1.0.0")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch("/api/paymentx/eligible", { cache: "no-store" })
        if (!res.ok) return
        const json: unknown = await res.json()
        if (cancelled || typeof json !== "object" || json === null) return
        const body = json as { eligible?: unknown; version?: unknown }
        if (body.eligible === true) {
          setEligible(true)
          if (typeof body.version === "string") setVersion(body.version)
        }
      } catch {
        /* not eligible */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (!eligible || blocks.length === 0) return null

  async function pay() {
    if (!agreedToTerms) {
      onTermsRequired()
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/paymentx/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blocks,
          useWallet,
          promoCode,
          agreedToTerms: true,
          mode: isDesktopDevice() ? "qr" : "h5",
          returnUrl: `${window.location.origin}/${locale}/book/paymentx`,
        }),
      })
      const json: unknown = await res.json().catch(() => null)
      const body = (typeof json === "object" && json !== null ? json : {}) as {
        error?: string
        message?: string
        payInfo?: string
        bookingId?: string
        paid?: boolean
        needsReview?: boolean
      }
      if (!res.ok) {
        setError(body.message ?? body.error ?? "付款初始化失敗，請重試。")
        return
      }
      if ((body.paid || body.needsReview) && body.bookingId) {
        window.location.href = `/${locale}/book/paymentx?bookingId=${encodeURIComponent(body.bookingId)}`
        return
      }
      if (!body.payInfo || !/^https:\/\//i.test(body.payInfo)) {
        setError("付款閘道回應格式錯誤，請重試。")
        return
      }
      window.location.href = body.payInfo
    } catch {
      setError("網絡錯誤，請重試。")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      style={{
        marginTop: 16,
        padding: "14px 16px",
        border: `1.5px dashed ${tokens.colors.borderStrong}`,
        borderRadius: 16,
        background: tokens.colors.surface,
        color: tokens.colors.text,
        fontFamily: tokens.font.sans,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontWeight: 700, fontSize: 15 }}>PaymentX</span>
        <span
          style={{
            fontSize: 11,
            padding: "2px 8px",
            borderRadius: 999,
            border: "1px solid #1a9d5c",
            color: "#22b86b",
          }}
        >
          測試 v{version}
        </span>
      </div>
      <p style={{ margin: "6px 0 12px", fontSize: 13, opacity: 0.7, lineHeight: 1.6 }}>
        KPay 全托管收銀台：前往 KPay 付款頁，在該頁選擇付款方式。只有測試帳戶看到此選項。
      </p>
      {error && <p style={{ margin: "0 0 10px", fontSize: 13, color: tokens.colors.danger }}>{error}</p>}
      <button
        type="button"
        onClick={() => void pay()}
        disabled={busy}
        style={{
          minHeight: 48,
          width: "100%",
          borderRadius: 14,
          border: "none",
          background: "#1a9d5c",
          color: "#fff",
          fontWeight: 600,
          fontSize: 15,
          cursor: busy ? "default" : "pointer",
          opacity: busy ? 0.6 : 1,
        }}
      >
        {busy ? "處理中…" : "用 PaymentX 付款"}
      </button>
    </div>
  )
}
