"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { getFaqItems, stripMarkdownLinks, type FaqItem } from "./faqData";

const FONT_FAMILY =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Noto Sans TC', 'Helvetica Neue', Helvetica, Arial, sans-serif";

const MD_LINK = /\[([^\]]+)\]\(([^)]+)\)/g;

function AnswerText({ answer }: { answer: string }) {
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  for (const match of answer.matchAll(MD_LINK)) {
    const [full, label, href] = match;
    const index = match.index ?? 0;
    if (index > lastIndex) nodes.push(answer.slice(lastIndex, index));
    nodes.push(
      <Link
        key={`${href}-${index}`}
        href={href}
        style={{ color: "#1a9d5c", textDecoration: "underline", textUnderlineOffset: "3px" }}
      >
        {label}
      </Link>
    );
    lastIndex = index + full.length;
  }
  if (lastIndex < answer.length) nodes.push(answer.slice(lastIndex));
  return <>{nodes}</>;
}

export default function HomeFAQ({
  ids,
  moreHref,
}: {
  ids?: readonly string[];
  moreHref?: string;
}) {
  const t = useTranslations("faq");
  const allItems: FaqItem[] = getFaqItems(t);
  const items: FaqItem[] = ids
    ? ids
        .map((id) => allItems.find((item) => item.id === id))
        .filter((item): item is FaqItem => item !== undefined)
    : allItems;

  const [openId, setOpenId] = useState<string | null>(null);

  const listRef = useRef<HTMLDivElement>(null);

  const toggle = (id: string) => {
    setOpenId((prev) => (prev === id ? null : id));
  };

  return (
    <section
      id="home-faq"
      data-nav-theme="light"
      style={{
        background: "#e8e8e8",
        padding: "120px 24px 140px",
      }}
    >
      <div className="faq-inner" style={{ maxWidth: 860, margin: "0 auto" }}>
        <div className="faq-head" style={{ marginBottom: 52 }}>
          <h2 className="faq-title" style={{
            fontFamily: FONT_FAMILY,
            fontWeight: 900,
            fontSize: "clamp(1.7rem, 3.6vw, 2.5rem)",
            color: "#111110",
            marginBottom: 14,
          }}>
            {t("title")}。
          </h2>
          <p className="faq-sub" style={{
            fontFamily: FONT_FAMILY,
            fontSize: 14.5,
            lineHeight: 1.8,
            color: "rgba(17,17,16,0.58)",
          }}>
            預訂、入場與場地守則，這裡都有答案。
          </p>
        </div>

        <div className="faq-list" ref={listRef} style={{ borderTop: "1px solid rgba(17,17,16,0.14)" }}>
          {items.map((item) => {
            const isOpen = openId === item.id;

            return (
              <div
                key={item.id}
                className={`faq-item ${isOpen ? "is-open" : ""}`}
                style={{ borderBottom: "1px solid rgba(17,17,16,0.14)" }}
              >
                <button
                  className="faq-q"
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => toggle(item.id)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 24,
                    background: "none",
                    border: 0,
                    padding: "26px 4px",
                    cursor: "pointer",
                    textAlign: "left",
                    font: "inherit",
                    color: "#111110",
                    transition: "color .3s ease",
                  }}
                >
                  <span style={{
                    fontFamily: FONT_FAMILY,
                    fontWeight: 700,
                    fontSize: "clamp(15px, 1.85vw, 17.5px)",
                    lineHeight: 1.5,
                  }}>
                    {item.question}
                  </span>
                  <i className="faq-icon-wrap" aria-hidden="true" />
                </button>

                <div
                  className="faq-answer"
                  style={{
                    overflow: "hidden",
                    maxHeight: isOpen ? "1000px" : "0px",
                    transition: "max-height .5s cubic-bezier(.3,.8,.35,1)",
                  }}
                >
                  <div className="faq-answer-inner" style={{
                    padding: "0 4px 28px",
                    fontFamily: FONT_FAMILY,
                    fontSize: 14.5,
                    lineHeight: 1.9,
                    color: "rgba(17,17,16,0.62)",
                    opacity: isOpen ? 1 : 0,
                    transform: isOpen ? "translateY(0)" : "translateY(-6px)",
                    transition: "opacity .45s ease .05s, transform .45s ease .05s",
                  }}>
                    <AnswerText answer={item.answer} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {moreHref && (
          <Link
            href={moreHref}
            style={{
              display: "inline-block",
              marginTop: 34,
              fontFamily: FONT_FAMILY,
              fontSize: 14.5,
              fontWeight: 500,
              color: "#1a9d5c",
              textDecoration: "underline",
              textUnderlineOffset: 4,
              textDecorationThickness: 1,
              transition: "color .3s ease, text-underline-offset .3s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "#0f7845";
              e.currentTarget.style.textUnderlineOffset = "6px";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "#1a9d5c";
              e.currentTarget.style.textUnderlineOffset = "4px";
            }}
          >
            {t("more")}
          </Link>
        )}
      </div>

      <style>{`
        @media (max-width: 560px) {
          .faq-section { padding: 86px 20px 96px; }
          .faq-head { margin-bottom: 36px; }
          .faq-q { padding: 22px 2px; gap: 16px; }
          .faq-answer-inner { font-size: 13.5px; padding-bottom: 24px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .faq-answer { transition: none !important; }
          .faq-answer-inner { transition: none !important; }
        }
      `}</style>
    </section>
  );
}