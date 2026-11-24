"use client"

import { useMemo, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { useTranslations } from "next-intl"
import type { LegalDocId } from "@/content/legal"
import type { LegalDocument } from "@/content/legal/types"
import type { Locale } from "@/i18n/routing"
import LegalDocumentRenderer from "@/components/legal/LegalDocumentRenderer"

const DARK = "#1D1D1F"
const SUBTLE = "#86868B"
const GREEN = "#22C55E"
const DIVIDER = "#E5E5E5"
const FONT_FAMILY = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Helvetica, Arial, sans-serif"
const EASE = [0.16, 1, 0.3, 1] as const

export default function LegalContent({
  locale,
  initialDoc,
  lastUpdated,
  pageTitle,
  lastUpdatedLabel,
  nav,
  documents,
}: {
  locale: Locale
  initialDoc: LegalDocId
  lastUpdated: string
  pageTitle: string
  lastUpdatedLabel: string
  nav: Record<LegalDocId, string>
  documents: Record<LegalDocId, LegalDocument>
}) {
  const t = useTranslations('legalPage')
  const router = useRouter()
  const pathname = usePathname()
  const [activeDoc, setActiveDoc] = useState<LegalDocId>(initialDoc)
  const [y, m, d] = lastUpdated.split("-").map(Number)
  const formattedUpdated = y && m && d ? `${y}${t('date_year')}${m}${t('date_month')}${d}${t('date_day')}` : lastUpdated
  // Grouped: venue → booking & payment → privacy & data → site → brand.
  const tabs: { id: LegalDocId; label: string }[] = [
    { id: "terms", label: nav.terms },
    { id: "refund_policy", label: nav.refund_policy },
    { id: "delivery_policy", label: nav.delivery_policy },
    { id: "privacy", label: nav.privacy },
    { id: "cookie_policy", label: nav.cookie_policy },
    { id: "space_pilot", label: "Space Pilot" },
    { id: "website_terms", label: nav.website_terms },
    { id: "accessibility", label: nav.accessibility },
    { id: "brand_statement", label: nav.brand_statement },
  ]

  const [query, setQuery] = useState("")
  const q = query.trim().toLowerCase()
  const hits = useMemo(() => {
    if (q.length < 1) return []
    const out: { id: LegalDocId; section: number; title: string; snippet: string }[] = []
    for (const tab of tabs) {
      const doc = documents[tab.id]
      const pool = [
        { section: -1, title: doc.title, text: [doc.subtitle, doc.intro, doc.callout?.body].filter(Boolean).join("\n") },
        ...doc.sections.map((sec, i) => ({ section: i, title: sec.title, text: sec.body })),
      ]
      for (const item of pool) {
        const hay = `${item.title}\n${item.text}`
        const at = hay.toLowerCase().indexOf(q)
        if (at < 0) continue
        const body = item.text
        const bi = body.toLowerCase().indexOf(q)
        const start = Math.max(0, (bi < 0 ? 0 : bi) - 24)
        const snippet = (start > 0 ? "…" : "") + body.slice(start, start + 90).replace(/\n+/g, " ") + (body.length > start + 90 ? "…" : "")
        out.push({ id: tab.id, section: item.section, title: item.title, snippet })
        if (out.length >= 12) return out
      }
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, documents])

  const openHit = (hit: { id: LegalDocId; section: number }) => {
    selectDoc(hit.id)
    setQuery("")
    window.setTimeout(() => {
      const el = hit.section >= 0 ? document.getElementById(`section-${hit.section + 1}`) : null
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" })
      else window.scrollTo({ top: 0, behavior: "smooth" })
    }, 400)
  }

  const selectDoc = (docId: LegalDocId) => {
    setActiveDoc(docId)
    const url = docId === "terms" ? pathname : `${pathname}?doc=${docId}`
    router.replace(url, { scroll: false })
  }

  return (
    <div data-nav-theme="light" style={{ background: "#fff", fontFamily: FONT_FAMILY }}>
      <section data-nav-theme="dark" style={{ background: "#000", color: "#fff", padding: "140px 24px 64px" }}>
        <div style={{ maxWidth: 820, margin: "0 auto" }}>
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE }}
            style={{ fontSize: "clamp(32px, 6vw, 48px)", fontWeight: 700, letterSpacing: "-0.03em", margin: 0 }}
          >
            {pageTitle}
          </motion.h1>
          <div style={{ marginTop: 28, position: "relative" }}>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("search_placeholder")}
              aria-label={t("search_placeholder")}
              data-cms-key="legalPage.search_placeholder"
              style={{ width: "100%", boxSizing: "border-box", padding: "14px 18px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.08)", color: "#fff", fontSize: 16, outline: "none", fontFamily: FONT_FAMILY }}
            />
            {q && (
              <div style={{ position: "absolute", left: 0, right: 0, top: "calc(100% + 8px)", zIndex: 20, background: "#fff", color: DARK, borderRadius: 14, boxShadow: "0 18px 50px rgba(0,0,0,0.35)", overflow: "hidden", maxHeight: "50vh", overflowY: "auto" }}>
                {hits.length === 0 ? (
                  <div style={{ padding: "16px 18px", fontSize: 15, color: SUBTLE }} data-cms-key="legalPage.search_empty">{t("search_empty")}</div>
                ) : (
                  hits.map((h, i) => (
                    <button
                      key={`${h.id}-${h.section}-${i}`}
                      type="button"
                      onClick={() => openHit(h)}
                      style={{ display: "block", width: "100%", textAlign: "left", appearance: "none", background: "transparent", border: "none", borderTop: i ? `1px solid ${DIVIDER}` : "none", padding: "12px 18px", cursor: "pointer", fontFamily: FONT_FAMILY }}
                    >
                      <div style={{ fontSize: 12, color: GREEN, fontWeight: 600 }}>{nav[h.id]}</div>
                      <div style={{ fontSize: 15, fontWeight: 600, marginTop: 2 }}>{h.title}</div>
                      <div style={{ fontSize: 13, color: SUBTLE, marginTop: 2 }}>{h.snippet}</div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      <section data-nav-theme="light" style={{ background: "#fff", borderBottom: `1px solid ${DIVIDER}`, position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 820, margin: "0 auto", display: "flex", gap: 8, padding: "0 24px", overflowX: "auto" }}>
          {tabs.map((tab) => {
            const active = activeDoc === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => selectDoc(tab.id)}
                style={{ appearance: "none", background: "transparent", border: "none", borderBottom: active ? `2px solid ${GREEN}` : "2px solid transparent", padding: "16px 4px", marginRight: 20, fontSize: 15, fontWeight: active ? 700 : 500, color: active ? DARK : SUBTLE, cursor: "pointer", whiteSpace: "nowrap", transition: "color 0.2s ease, border-color 0.2s ease" }}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      </section>

      <section style={{ padding: "clamp(48px, 8vw, 88px) 24px 96px" }}>
        <div style={{ maxWidth: 820, margin: "0 auto" }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeDoc}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3, ease: EASE }}
            >
              <LegalDocumentRenderer document={documents[activeDoc]} locale={locale} />
            </motion.div>
          </AnimatePresence>
          <p style={{ marginTop: 48, fontSize: 14, color: SUBTLE }}>
            {lastUpdatedLabel}：{formattedUpdated}
          </p>
        </div>
      </section>
    </div>
  )
}
