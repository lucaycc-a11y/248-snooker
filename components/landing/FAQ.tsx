"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { faqItems, faqJsonLd } from "./faqData";

const DARK = "#1D1D1F";
const DIVIDER = "#D2D2D7";

const FONT_FAMILY =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Helvetica, Arial, sans-serif";

const EASE = [0.16, 1, 0.3, 1] as const;
const VIEWPORT = { once: true, amount: 0.2 } as const;

export default function FAQ() {
  // Only one item open at a time. null = all closed.
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <section
      id="faq"
      data-nav-theme="light"
      style={{
        background: "#F5F5F7",
        color: DARK,
        padding: "clamp(88px, 12vw, 140px) 24px",
        fontFamily: FONT_FAMILY,
      }}
      data-cms-key="faq_section"
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
          data-cms-key="faq_title"
        >
          常見問題。
        </motion.h2>

        <div>
          {faqItems.map((item) => {
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
                        }}
                      >
                        {item.answer}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </details>
            );
          })}
        </div>
      </div>
    </section>
  );
}
