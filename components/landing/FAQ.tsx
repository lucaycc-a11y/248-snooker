"use client";

import { useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { getFaqItems, stripMarkdownLinks, type FaqItem } from "./faqData";

const DARK = "#1D1D1F";
const DIVIDER = "#D2D2D7";

const FONT_FAMILY =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Helvetica, Arial, sans-serif";

const EASE = [0.16, 1, 0.3, 1] as const;
const VIEWPORT = { once: true, amount: 0.2 } as const;

// Rule-type answers reference the authoritative source (/legal, /pricing,
// /membership) via markdown-style links — [label](/path) — instead of
// restating the full clause text. Render those as locale-aware <Link>s so
// one click jumps straight to the relevant section.
const MD_LINK = /\[([^\]]+)\]\(([^)]+)\)/g;

function AnswerText({ answer }: { answer: string }) {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  for (const match of answer.matchAll(MD_LINK)) {
    const [full, label, href] = match;
    const index = match.index ?? 0;
    if (index > lastIndex) nodes.push(answer.slice(lastIndex, index));
    nodes.push(
      <Link
        key={`${href}-${index}`}
        href={href}
        style={{ color: "#0071E3", textDecoration: "underline", textUnderlineOffset: "3px" }}
      >
        {label}
      </Link>
    );
    lastIndex = index + full.length;
  }
  if (lastIndex < answer.length) nodes.push(answer.slice(lastIndex));
  return <>{nodes}</>;
}

// FAQ list is a fixed, static set of Q&A pairs sourced from the `faq`
// next-intl namespace (see faqData.ts) — no longer addable/removable via a
// runtime CMS list (see app/[locale]/layout.tsx for why runtime CMS reads
// were dropped in favour of static next-intl content).
// jsonLd is optionally passed by the page for a server-rendered <script> tag
// identical to what this component would derive itself, avoiding drift.
// `ids` narrows the rendered list to a curated subset (homepage shows 5 of
// them, in the given order); `moreHref` adds a "了解更多" link below the list.
export default function FAQ({
  jsonLd,
  ids,
  moreHref,
}: {
  jsonLd?: object;
  ids?: readonly string[];
  moreHref?: string;
}) {
  const t = useTranslations('faq');
  const allItems: FaqItem[] = getFaqItems(t);
  const items: FaqItem[] = ids
    ? ids
        .map((id) => allItems.find((item) => item.id === id))
        .filter((item): item is FaqItem => item !== undefined)
    : allItems;
  // Only one item open at a time. null = all closed.
  const [openId, setOpenId] = useState<string | null>(null);

  const faqJsonLd =
    jsonLd ?? {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: items.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: { "@type": "Answer", text: stripMarkdownLinks(item.answer) },
      })),
    };

  return (
    <section
      id="faq"
      data-nav-theme="light"
      style={{
        background: "rgba(245,245,247,0.92)",
        color: DARK,
        padding: "clamp(88px, 12vw, 140px) 24px",
        fontFamily: FONT_FAMILY,
      }}
    >
      {/* JSON-LD structured data for FAQ rich results. Content is fully static
          and contains no <, >, or & characters, so JSX text escaping is safe. */}
      <script type="application/ld+json">{JSON.stringify(faqJsonLd)}</script>

      <div style={{ maxWidth: "820px", margin: "0 auto" }}>
        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={VIEWPORT}
          transition={{ duration: 0.6, ease: EASE }}
          style={{
            fontSize: "clamp(44px, 7vw, 64px)",
            fontWeight: 700,
            letterSpacing: "-0.03em",
            margin: "0 0 clamp(40px, 6vw, 56px)",
          }}
        >
          {t('title')}。
        </motion.h2>

        <div>
          {items.map((item) => {
            const isOpen = openId === item.id;
            return (
              <details
                key={item.id}
                id={item.id}
                open={isOpen}
                style={{ borderBottom: `1px solid ${DIVIDER}` }}
              >
                <summary
                  onClick={(e) => {
                    // Take over native toggle so framer-motion drives the visual,
                    // while keeping real <details>/<summary> for crawlers.
                    e.preventDefault();
                    setOpenId((prev) => (prev === item.id ? null : item.id));
                  }}
                  style={{
                    listStyle: "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "32px",
                    padding: "32px 4px",
                    userSelect: "none",
                  }}
                >
                  <span
                    style={{
                      fontSize: "17px",
                      fontWeight: 500,
                      color: DARK,
                      lineHeight: 1.4,
                    }}
                  >
                    {item.question}
                  </span>
                  <motion.span
                    aria-hidden="true"
                    animate={{ rotate: isOpen ? 90 : 0 }}
                    transition={{ duration: 0.3, ease: EASE }}
                    style={{
                      flexShrink: 0,
                      display: "inline-flex",
                      color: "#86868B",
                      fontSize: "22px",
                      lineHeight: 1,
                    }}
                  >
                    ›
                  </motion.span>
                </summary>

                {/* Answer stays mounted (height-animated, not unmounted) so the
                    text is always in the DOM for search engines. */}
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      key="answer"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.35, ease: EASE }}
                      style={{ overflow: "hidden" }}
                    >
                      <p
                        style={{
                          fontSize: "16px",
                          lineHeight: 1.6,
                          color: "#494951",
                          margin: 0,
                          padding: "0 4px 40px",
                          maxWidth: "680px",
                          whiteSpace: "pre-line",
                        }}
                      >
                        <AnswerText answer={item.answer} />
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </details>
            );
          })}
        </div>

        {moreHref && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={VIEWPORT}
            transition={{ duration: 0.5, ease: EASE }}
            style={{ marginTop: "40px" }}
          >
            <Link
              href={moreHref}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                minHeight: 44,
                fontSize: "17px",
                fontWeight: 500,
                color: "#0071E3",
                textDecoration: "none",
              }}
            >
              {t("more")}
              <span aria-hidden="true" style={{ fontSize: "20px", lineHeight: 1 }}>
                ›
              </span>
            </Link>
          </motion.div>
        )}
      </div>
    </section>
  );
}
