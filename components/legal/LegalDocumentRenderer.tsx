"use client"

import { motion } from "framer-motion"
import type { LegalDocument } from "@/content/legal/types"
import type { Locale } from "@/i18n/routing"
import { highlightKeyPhrases } from "@/app/[locale]/legal/legalKeyPhrases"

const DARK = "#1D1D1F"
const SUBTLE = "#86868B"
const GREEN = "#22C55E"
const DIVIDER = "#E5E5E5"
const EASE = [0.16, 1, 0.3, 1] as const

export function LegalBodyParagraphs({ body, locale, compact = false }: {
  body: string
  locale: Locale
  compact?: boolean
}) {
  const lines = body.split("\n").filter((line) => line.length > 0)
  return (
    <>
      {lines.map((line, i) => (
        <p
          key={i}
          style={{
            fontSize: compact ? 14 : 16,
            lineHeight: 1.65,
            color: compact ? "rgba(255,255,255,0.78)" : "#494951",
            margin: i === lines.length - 1 ? 0 : "0 0 14px",
          }}
        >
          {highlightKeyPhrases(line, locale)}
        </p>
      ))}
    </>
  )
}

export function LegalSectionList({ sections, locale, compact = false }: {
  sections: LegalDocument["sections"]
  locale: Locale
  compact?: boolean
}) {
  return (
    <>
      {sections.map((section, i) => (
        <motion.div
          key={`${i}-${section.title}`}
          initial={compact ? undefined : { opacity: 0, y: 20 }}
          whileInView={compact ? undefined : { opacity: 1, y: 0 }}
          viewport={compact ? undefined : { once: true, amount: 0.3 }}
          transition={compact ? undefined : { duration: 0.5, ease: EASE }}
          id={`section-${i + 1}`}
          style={{ marginBottom: compact ? 28 : 40, scrollMarginTop: 76 }}
        >
          <h3
            style={{
              display: "flex",
              gap: 12,
              fontSize: compact ? 17 : 20,
              fontWeight: 700,
              letterSpacing: "-0.01em",
              color: compact ? "#fff" : DARK,
              margin: "0 0 10px",
            }}
          >
            <span style={{ color: GREEN, fontVariantNumeric: "tabular-nums" }}>
              {String(i + 1).padStart(2, "0")}
            </span>
            {section.title}
          </h3>
          <div style={{ paddingLeft: compact ? 0 : 36 }}>
            <LegalBodyParagraphs body={section.body} locale={locale} compact={compact} />
          </div>
        </motion.div>
      ))}
    </>
  )
}

export default function LegalDocumentRenderer({ document, locale, compact = false }: {
  document: LegalDocument
  locale: Locale
  compact?: boolean
}) {
  const rawSubtitle = document.subtitle ?? ""
  const newlineIdx = rawSubtitle.indexOf("\n")
  const noticeLabel = newlineIdx > -1 ? rawSubtitle.slice(0, newlineIdx) : ""
  const subtitleBody = newlineIdx > -1 ? rawSubtitle.slice(newlineIdx + 1) : rawSubtitle
  const intro = document.intro ?? ""
  const lead = rawSubtitle ? subtitleBody : intro
  const hasLead = Boolean(lead)

  return (
    <article style={{ color: compact ? "#fff" : DARK }}>
      <h2 style={{
        fontSize: compact ? 22 : 28,
        lineHeight: 1.25,
        fontWeight: 700,
        letterSpacing: "-0.02em",
        color: compact ? "#fff" : DARK,
        margin: "0 0 24px",
      }}>
        {document.title}
      </h2>
      {hasLead && (
        <div style={{
          border: compact ? `1px solid rgba(255,255,255,0.12)` : `1px solid ${DIVIDER}`,
          borderLeft: compact ? `3px solid ${GREEN}` : `3px solid ${GREEN}`,
          borderRadius: 12,
          padding: compact ? "16px 18px" : "20px 24px",
          marginBottom: compact ? 32 : 56,
        }}>
          {noticeLabel && (
            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.04em", color: GREEN, marginBottom: 8 }}>
              {noticeLabel}
            </div>
          )}
          <p style={{ fontSize: compact ? 14 : 16, lineHeight: 1.7, color: compact ? "rgba(255,255,255,0.78)" : "#494951", margin: 0, whiteSpace: "pre-line" }}>
            {highlightKeyPhrases(lead, locale)}
          </p>
        </div>
      )}
      <LegalSectionList sections={document.sections} locale={locale} compact={compact} />
    </article>
  )
}
