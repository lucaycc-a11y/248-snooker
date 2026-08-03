"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import type { LegalDocId } from "@/content/legal";
import type { LegalDocument } from "@/content/legal/types";
import type { Locale } from "@/i18n/routing";
import { highlightKeyPhrases } from "./legalKeyPhrases";

const DARK = "#1D1D1F";
const SUBTLE = "#86868B";
const GREEN = "#22C55E";
const DIVIDER = "#E5E5E5";

const FONT_FAMILY =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Helvetica, Arial, sans-serif";

const EASE = [0.16, 1, 0.3, 1] as const;

// Each section's `body` is a single verbatim string with "小標籤：內容"-style
// sub-clauses joined by "\n" (see content/legal/*.ts). Split on "\n" and
// render each sub-clause as its own <p> (instead of one <p> with
// whiteSpace:pre-line) purely so CSS margin can give each clause its own
// visual block — the text itself is untouched, only how the same "\n"
// breaks are turned into DOM elements changes.
function BodyParagraphs({ body, locale }: { body: string; locale: Locale }) {
  const lines = body.split("\n").filter((line) => line.length > 0);
  return (
    <>
      {lines.map((line, i) => (
        <p
          key={i}
          style={{
            fontSize: "16px",
            lineHeight: 1.65,
            color: "#494951",
            margin: i === lines.length - 1 ? 0 : "0 0 14px",
          }}
        >
          {highlightKeyPhrases(line, locale)}
        </p>
      ))}
    </>
  );
}

// Numbered legal sections, rendered verbatim from the static content/legal/
// document object — no CMS, no runtime fetch, no add/remove/reorder (the
// content is fixed legal text, not an editable list).
// Each section carries id="section-N" (1-based, matching the visible 01/02/…
// numbering) so external pages (e.g. FAQ answers) can deep-link straight to a
// clause via /legal?doc=terms#section-N. scrollMarginTop keeps the heading
// clear of the sticky tab bar when the browser jumps to the hash.
function SectionList({ sections, locale }: { sections: LegalDocument["sections"]; locale: Locale }) {
  return (
    <>
      {sections.map((s, i) => (
        <motion.div
          key={`${i}-${s.title}`}
          id={`section-${i + 1}`}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5, ease: EASE }}
          style={{ marginBottom: 40, scrollMarginTop: 76 }}
        >
          <h3
            style={{
              display: "flex",
              gap: "12px",
              fontSize: "20px",
              fontWeight: 700,
              letterSpacing: "-0.01em",
              color: DARK,
              margin: "0 0 10px",
            }}
          >
            <span style={{ color: GREEN, fontVariantNumeric: "tabular-nums" }}>
              {String(i + 1).padStart(2, "0")}
            </span>
            {s.title}
          </h3>
          <div style={{ paddingLeft: "36px" }}>
            <BodyParagraphs body={s.body} locale={locale} />
          </div>
        </motion.div>
      ))}
    </>
  );
}

export default function LegalContent({
  locale,
  initialDoc,
  lastUpdated,
  pageTitle,
  lastUpdatedLabel,
  nav,
  documents,
}: {
  locale: Locale;
  initialDoc: LegalDocId;
  lastUpdated: string;
  pageTitle: string;
  lastUpdatedLabel: string;
  nav: Record<LegalDocId, string>;
  documents: Record<LegalDocId, LegalDocument>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [activeDoc, setActiveDoc] = useState<LegalDocId>(initialDoc);

  // lastUpdated arrives as an ISO date ("2026-07-14") from config; render as
  // the Chinese date format used on this page ("2026年7月14日").
  const [y, m, d] = lastUpdated.split("-").map(Number);
  const formattedUpdated = y && m && d ? `${y}年${m}月${d}日` : lastUpdated;

  const selectDoc = (docId: LegalDocId) => {
    setActiveDoc(docId);
    const url = docId === "terms" ? pathname : `${pathname}?doc=${docId}`;
    router.replace(url, { scroll: false });
  };

  // Doc 1 — 場地使用守則及條款 — verbatim intro is prefixed with the source's
  // own "【重要提示】" label; split it out so it can be styled as a heading
  // without altering a single character of the sentence that follows.
  const termsDoc = documents.terms;
  const rawSubtitle = termsDoc.subtitle ?? "";
  const newlineIdx = rawSubtitle.indexOf("\n");
  const noticeLabel = newlineIdx > -1 ? rawSubtitle.slice(0, newlineIdx) : "";
  const termsIntroBody = newlineIdx > -1 ? rawSubtitle.slice(newlineIdx + 1) : rawSubtitle;

  const tabs: { id: LegalDocId; label: string }[] = [
    { id: "terms", label: nav.terms },
    { id: "website_terms", label: nav.website_terms },
    { id: "privacy", label: nav.privacy },
    { id: "accessibility", label: nav.accessibility },
  ];

  return (
    <div data-nav-theme="dark" style={{ background: "#ffffff", fontFamily: FONT_FAMILY }}>
      {/* Hero — black */}
      <section
        data-nav-theme="dark"
        style={{ background: "#000000", color: "white", padding: "140px 24px 64px" }}
      >
        <div style={{ maxWidth: "820px", margin: "0 auto" }}>
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

      {/* Tab bar */}
      <section style={{ background: "#ffffff", borderBottom: `1px solid ${DIVIDER}`, position: "sticky", top: 0, zIndex: 10 }}>
        <div
          style={{
            maxWidth: "820px",
            margin: "0 auto",
            display: "flex",
            gap: "8px",
            padding: "0 24px",
            overflowX: "auto",
          }}
        >
          {tabs.map((tab) => {
            const active = activeDoc === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => selectDoc(tab.id)}
                style={{
                  appearance: "none",
                  background: "transparent",
                  border: "none",
                  borderBottom: active ? `2px solid ${GREEN}` : "2px solid transparent",
                  padding: "16px 4px",
                  marginRight: "20px",
                  fontSize: "15px",
                  fontWeight: active ? 700 : 500,
                  color: active ? DARK : SUBTLE,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  transition: "color 0.2s ease, border-color 0.2s ease",
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* Content */}
      <section style={{ padding: "clamp(48px, 8vw, 88px) 24px 96px" }}>
        <div style={{ maxWidth: "820px", margin: "0 auto" }}>
          <AnimatePresence mode="wait">
            {activeDoc === "terms" && (
              <motion.div
                key="terms"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.3, ease: EASE }}
              >
                <h2
                  style={{ fontSize: "28px", fontWeight: 700, letterSpacing: "-0.02em", color: DARK, margin: "0 0 24px" }}
                >
                  {termsDoc.title}
                </h2>
                {/* Verbatim intro — 【重要提示】 */}
                <div
                  style={{
                    border: `1px solid ${DIVIDER}`,
                    borderLeft: `3px solid ${GREEN}`,
                    borderRadius: "12px",
                    padding: "20px 24px",
                    marginBottom: "56px",
                  }}
                >
                  <div
                    style={{ fontSize: "13px", fontWeight: 700, letterSpacing: "0.04em", color: GREEN, marginBottom: "8px" }}
                  >
                    {noticeLabel}
                  </div>
                  <p style={{ fontSize: "16px", lineHeight: 1.7, color: "#494951", margin: 0, whiteSpace: "pre-line" }}>
                    {highlightKeyPhrases(termsIntroBody, locale)}
                  </p>
                </div>

                <SectionList sections={termsDoc.sections} locale={locale} />
              </motion.div>
            )}

            {activeDoc === "website_terms" && (
              <motion.div
                key="website_terms"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.3, ease: EASE }}
              >
                <h2
                  style={{ fontSize: "28px", fontWeight: 700, letterSpacing: "-0.02em", color: DARK, margin: "0 0 24px" }}
                >
                  {documents.website_terms.title}
                </h2>
                <p style={{ fontSize: "16px", lineHeight: 1.7, color: "#494951", margin: "0 0 56px", whiteSpace: "pre-line" }}>
                  {highlightKeyPhrases(documents.website_terms.intro ?? "", locale)}
                </p>

                <SectionList sections={documents.website_terms.sections} locale={locale} />
              </motion.div>
            )}

            {activeDoc === "privacy" && (
              <motion.div
                key="privacy"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.3, ease: EASE }}
              >
                <h2
                  style={{ fontSize: "28px", fontWeight: 700, letterSpacing: "-0.02em", color: DARK, margin: "0 0 24px" }}
                >
                  {documents.privacy.title}
                </h2>
                <p style={{ fontSize: "16px", lineHeight: 1.7, color: "#494951", margin: "0 0 56px", whiteSpace: "pre-line" }}>
                  {highlightKeyPhrases(documents.privacy.intro ?? "", locale)}
                </p>

                <SectionList sections={documents.privacy.sections} locale={locale} />
              </motion.div>
            )}

            {activeDoc === "accessibility" && (
              <motion.div
                key="accessibility"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.3, ease: EASE }}
              >
                <h2
                  style={{ fontSize: "28px", fontWeight: 700, letterSpacing: "-0.02em", color: DARK, margin: "0 0 24px" }}
                >
                  {documents.accessibility.title}
                </h2>

                <SectionList sections={documents.accessibility.sections} locale={locale} />
              </motion.div>
            )}
          </AnimatePresence>

          <p style={{ marginTop: "48px", fontSize: "14px", color: SUBTLE }}>
            {lastUpdatedLabel}：{formattedUpdated}
          </p>
        </div>
      </section>
    </div>
  );
}
