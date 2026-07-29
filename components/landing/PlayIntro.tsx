"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

const FONT_FAMILY =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Noto Sans TC', 'Helvetica Neue', Helvetica, Arial, sans-serif";

/* ── Inline SVG icon components (from reference HTML) ── */

function CoinIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <g className="pk-coin">
        <circle cx="10.2" cy="10.2" r="6.6" />
        <path d="M10.2 7.4v5.6" />
        <path d="M8.6 8.6h3.2" />
      </g>
      <path className="pk-spark pk-spark1" d="M17.6 14.4v3" />
      <path className="pk-spark pk-spark2" d="M16.1 15.9h3" />
      <path d="M14.4 17.2a6.6 6.6 0 0 1-8.8-8.8" opacity=".45" />
    </svg>
  );
}

function TrendIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path className="pk-trend" d="M3 16.6l5.2-5.2 3.4 3.4L20 6.4" />
      <path className="pk-arrow" d="M15.2 6.4H20v4.8" />
    </svg>
  );
}

function GiftIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.4 11.4h15.2v8.2a1.4 1.4 0 0 1-1.4 1.4H5.8a1.4 1.4 0 0 1-1.4-1.4z" />
      <path d="M12 11.4V21" />
      <g className="pk-gift-lid">
        <rect x="3" y="7.4" width="18" height="4" rx="1.2" />
      </g>
      <g className="pk-gift-bow">
        <path d="M12 7.4S10.6 3 8.4 3a2 2 0 0 0 0 4.4z" />
        <path d="M12 7.4S13.4 3 15.6 3a2 2 0 0 1 0 4.4z" />
      </g>
    </svg>
  );
}

function TilesIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect className="pk-tile pk-t1" x="3.2" y="3.2" width="7.2" height="7.2" rx="1.5" />
      <rect className="pk-tile pk-t2" x="13.6" y="3.2" width="7.2" height="7.2" rx="1.5" />
      <rect className="pk-tile pk-t3" x="3.2" y="13.6" width="7.2" height="7.2" rx="1.5" />
      <rect className="pk-tile pk-t4" x="13.6" y="13.6" width="7.2" height="7.2" rx="1.5" />
    </svg>
  );
}

const ICONS = [CoinIcon, TrendIcon, GiftIcon, TilesIcon];

interface CardItem {
  title: string;
  body: string;
}

export default function PlayIntro() {
  const t = useTranslations("membershipPage");
  const howItems = t.raw("how_items") as CardItem[];
  const secRef = useRef<HTMLElement>(null);
  const [isIn, setIsIn] = useState(false);

  useEffect(() => {
    const el = secRef.current;
    if (!el) return;
    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      !("IntersectionObserver" in window)
    ) {
      setIsIn(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          setIsIn(true);
          obs.unobserve(e.target);
        });
      },
      { threshold: 0.2, rootMargin: "0px 0px -6% 0px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section
      ref={secRef}
      className={`pi-section ${isIn ? "is-in" : ""}`}
      data-nav-theme="light"
      style={{
        background: "#ffffff",
        padding: "clamp(86px, 10vw, 120px) 24px clamp(96px, 10vw, 130px)",
      }}
    >
      <div className="pi-inner" style={{ maxWidth: 1120, margin: "0 auto" }}>
        <h2
          className="pi-title"
          style={{
            fontFamily: "'Noto Sans TC', sans-serif",
            fontWeight: 900,
            fontSize: "clamp(1.8rem, 3.8vw, 2.6rem)",
            color: "#111110",
            marginBottom: 56,
          }}
        >
          {t("how_title")}
        </h2>

        <div className="pi-grid">
          {howItems.map((item, i) => {
            const Icon = ICONS[i] ?? CoinIcon;
            return (
              <div key={item.title} className="pi-card">
                <div className="pi-ic">
                  <Icon />
                </div>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </div>
            );
          })}
        </div>

        <div className="pi-actions">
          <Link
            href="/book"
            className="pbtn-primary"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              fontFamily: "'Noto Sans TC', sans-serif",
              fontSize: 15.5,
              fontWeight: 500,
              padding: "17px 40px",
              borderRadius: 999,
              textDecoration: "none",
              color: "#fff",
              background: "linear-gradient(135deg,#2ac878 0%,#1a9d5c 55%,#0f7845 100%)",
              boxShadow: "0 12px 30px -12px rgba(26,157,92,0.75), 0 2px 6px rgba(26,157,92,0.25)",
            }}
          >
            {t("cta_book")}
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.1"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ width: 17, height: 17, flexShrink: 0 }}
            >
              <path d="M5 12h14" />
              <path d="m13 6 6 6-6 6" />
            </svg>
          </Link>
          <Link
            href="/member"
            className="pbtn-ghost"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              fontFamily: "'Noto Sans TC', sans-serif",
              fontSize: 15.5,
              fontWeight: 500,
              padding: "17px 40px",
              borderRadius: 999,
              textDecoration: "none",
              color: "#111110",
              background: "transparent",
              border: "1.5px solid rgba(17,17,16,0.20)",
            }}
          >
            {t("cta_login")}
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.1"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ width: 17, height: 17, flexShrink: 0 }}
            >
              <path d="M10 17l5-5-5-5" />
              <path d="M15 12H3" />
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}