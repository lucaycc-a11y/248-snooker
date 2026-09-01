"use client"

import { useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
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
  const router = useRouter()
  const pathname = usePathname()
  const [activeDoc, setActiveDoc] = useState<LegalDocId>(initialDoc)
  const [y, m, d] = lastUpdated.split("-").map(Number)
  const formattedUpdated = y && m && d ? `${y}年${m}月${d}日` : lastUpdated
  const tabs: { id: LegalDocId; label: string }[] = [
    { id: "terms", label: nav.terms },
    { id: "website_terms", label: nav.website_terms },
    { id: "privacy", label: nav.privacy },
    { id: "accessibility", label: nav.accessibility },
    { id: "refund_policy", label: nav.refund_policy },
    { id: "delivery_policy", label: nav.delivery_policy },
  ]

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
