"use client"

import { useEffect, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { detectInAppBrowser, type InAppBrowser } from "@/lib/browser/in-app"
import { tokens } from "@/app/styles/tokens"

// Shown at the top of /book inside WeChat / QQ / Weibo / Facebook / Instagram / Line / TikTok
// in-app browsers: some payment pages (AlipayHK especially) refuse to open there and tell the
// customer to copy the link into a real browser. Recommending the switch BEFORE they pick
// slots avoids losing a half-made booking, because the browser change drops sessionStorage.
export default function InAppBrowserNotice() {
  const t = useTranslations("book")
  const [app, setApp] = useState<InAppBrowser | null>(null)
  const [copied, setCopied] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const url = typeof window === "undefined" ? "" : `${window.location.origin}/book`

  useEffect(() => {
    setApp(detectInAppBrowser(navigator.userAgent))
  }, [])

  if (!app || dismissed) return null

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard blocked in this webview: select the link so it can be long-pressed and copied.
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }

  return (
    <div
      role="note"
      style={{ margin: "0 0 12px", padding: 14, borderRadius: 14, border: `1px solid ${tokens.colors.border}`, background: tokens.colors.surface, display: "flex", flexDirection: "column", gap: 8 }}
    >
      <strong style={{ color: tokens.colors.text, fontSize: 14 }} data-cms-key="book.inapp.title">{t("inapp_title")}</strong>
      <p style={{ margin: 0, color: tokens.colors.textMuted, fontSize: 13, lineHeight: 1.6 }} data-cms-key="book.inapp.desc">
        {app === "wechat" ? t("inapp_desc_wechat") : t("inapp_desc")}
      </p>
      <input
        ref={inputRef}
        readOnly
        value={url}
        onFocus={(e) => e.currentTarget.select()}
        aria-label={t("inapp_link_label")}
        style={{ width: "100%", minHeight: 40, padding: "0 12px", borderRadius: 10, border: `1px solid ${tokens.colors.border}`, background: "transparent", color: tokens.colors.text, fontSize: 13 }}
      />
      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          onClick={() => void copy()}
          style={{ minHeight: 44, padding: "0 16px", borderRadius: 12, border: "none", background: tokens.colors.brand, color: "#000", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
        >
          {copied ? t("inapp_copied") : t("inapp_copy")}
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          style={{ minHeight: 44, padding: "0 16px", borderRadius: 12, border: `1px solid ${tokens.colors.border}`, background: "transparent", color: tokens.colors.text, fontSize: 14, cursor: "pointer" }}
        >
          {t("inapp_dismiss")}
        </button>
      </div>
    </div>
  )
}
