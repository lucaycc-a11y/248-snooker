"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { PricingPeriod } from "@/lib/data/pricing";

const FONT_FAMILY =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Noto Sans TC', 'Helvetica Neue', Helvetica, Arial, sans-serif";

function fmt(value: number): string {
  return `HK$${Math.round(value)}`;
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="price-ic" style={{ width: 30, height: 30, color: "#1a9d5c", marginBottom: 20, display: "block", overflow: "visible" }}>
      <circle className="pi-sun-core" cx="12" cy="12" r="4.1" />
      <g className="pi-sun-rays">
        <line x1="12" y1="1.6" x2="12" y2="3.8" />
        <line x1="12" y1="20.2" x2="12" y2="22.4" />
        <line x1="1.6" y1="12" x2="3.8" y2="12" />
        <line x1="20.2" y1="12" x2="22.4" y2="12" />
        <line x1="4.6" y1="4.6" x2="6.2" y2="6.2" />
        <line x1="17.8" y1="17.8" x2="19.4" y2="19.4" />
        <line x1="4.6" y1="19.4" x2="6.2" y2="17.8" />
        <line x1="17.8" y1="6.2" x2="19.4" y2="4.6" />
      </g>
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="price-ic" style={{ width: 30, height: 30, color: "#1a9d5c", marginBottom: 20, display: "block", overflow: "visible" }}>
      <circle className="pi-bolt-glow" cx="12" cy="12" r="7" fill="currentColor" stroke="none" />
      <path className="pi-bolt" d="M14.6 2.6 6.4 13.4h5.2l-2.2 8 8.2-10.8h-5.2z" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="price-ic" style={{ width: 30, height: 30, color: "#1a9d5c", marginBottom: 20, display: "block", overflow: "visible" }}>
      <path className="pi-moon" d="M20.4 14.6A8.6 8.6 0 0 1 9.4 3.6a8.6 8.6 0 1 0 11 11z" />
      <circle className="pi-star pi-star1" cx="17.6" cy="5.2" r="1" fill="currentColor" stroke="none" />
      <circle className="pi-star pi-star2" cx="20.4" cy="9.4" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

export default function HomePricing({ periods }: { periods: PricingPeriod[] }) {
  const t = useTranslations("pricingPage");

  const effectiveRate = (p: PricingPeriod) => p.rateFrom2h ?? p.rate;
  const bestValueId = periods.reduce(
    (best, p) => (effectiveRate(p) < effectiveRate(best) ? p : best),
    periods[0],
  )?.id;

  const secRef = useRef<HTMLDivElement>(null);
  const [isIn, setIsIn] = useState(false);

  useEffect(() => {
    const el = secRef.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
        !("IntersectionObserver" in window)) { setIsIn(true); return; }
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        setIsIn(true);
        obs.unobserve(e.target);
      });
    }, { threshold: 0.2, rootMargin: "0px 0px -6% 0px" });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const getIcon = (id: string) => {
    if (id === "morning") return <SunIcon />;
    if (id === "afternoon") return <BoltIcon />;
    return <MoonIcon />;
  };

  return (
    <section
      ref={secRef}
      className={`price-section ${isIn ? "is-in" : ""}`}
      data-nav-theme="light"
      style={{
        background: "#ffffff",
        padding: "120px 24px 130px",
      }}
    >
      <div className="price-inner" style={{ maxWidth: 1120, margin: "0 auto" }}>
        <h2 className="price-title" style={{
          fontFamily: FONT_FAMILY,
          fontWeight: 900,
          fontSize: "clamp(1.8rem, 3.8vw, 2.6rem)",
          color: "#111110",
          marginBottom: 12,
        }}>
          {t("periods_title")}。
        </h2>
        <p className="price-sub" style={{
          fontFamily: FONT_FAMILY,
          fontSize: 14.5,
          color: "rgba(17,17,16,0.55)",
          marginBottom: 56,
        }}>
          {t("periods_subtitle")}
        </p>

        <div className="price-grid" style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 26,
          alignItems: "stretch",
        }}>
          {periods.map((period) => {
            const isBestValue = period.id === bestValueId;

            return (
              <div
                key={period.id}
                className="price-card"
                style={{
                  position: "relative",
                  background: "#ffffff",
                  border: "1px solid rgba(17,17,16,0.12)",
                  borderRadius: 18,
                  padding: "44px 28px 34px",
                  textAlign: "center",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  opacity: 0,
                  transform: "translateY(24px)",
                  transition: "opacity .8s cubic-bezier(.2,.7,.3,1), transform .8s cubic-bezier(.2,.7,.3,1), border-color .35s ease, box-shadow .35s ease",
                }}
              >
                {isBestValue && (
                  <span className="price-badge" style={{
                    position: "absolute",
                    top: -13,
                    left: "50%",
                    transform: "translateX(-50%)",
                    background: "#1a9d5c",
                    color: "#fff",
                    fontFamily: FONT_FAMILY,
                    fontSize: 11.5,
                    fontWeight: 700,
                    padding: "6px 14px",
                    borderRadius: 999,
                    whiteSpace: "nowrap",
                    boxShadow: "0 6px 16px -6px rgba(26,157,92,0.7)",
                  }}>
                    {t("badge_best_value")}
                  </span>
                )}

                {getIcon(period.id)}

                <h3 className="price-name" style={{
                  fontFamily: FONT_FAMILY,
                  fontWeight: 700,
                  fontSize: 19,
                  color: "#111110",
                  marginBottom: 8,
                }}>
                  {t(`period_${period.id}_title`)}
                </h3>

                <p className="price-time" style={{
                  fontFamily: FONT_FAMILY,
                  fontSize: 13.5,
                  color: "rgba(17,17,16,0.48)",
                  marginBottom: 24,
                }}>
                  {t(`period_${period.id}_time`)}
                </p>

                <div className="price-amount" style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "center",
                  gap: 5,
                  marginBottom: 18,
                }}>
                  <b style={{
                    fontFamily: FONT_FAMILY,
                    fontWeight: 600,
                    fontSize: "clamp(2.1rem, 4.4vw, 2.9rem)",
                    letterSpacing: "-0.02em",
                    color: "#111110",
                    lineHeight: 1,
                  }}>
                    {fmt(period.rate)}
                  </b>
                  <span style={{
                    fontFamily: FONT_FAMILY,
                    fontSize: 13.5,
                    color: "rgba(17,17,16,0.45)",
                  }}>
                    {" "}{t("per_hour")}
                  </span>
                </div>

                {period.rateFrom2h !== undefined ? (
                  <span className="price-deal" style={{
                    display: "inline-block",
                    background: "rgba(26,157,92,0.13)",
                    color: "#137a46",
                    fontFamily: FONT_FAMILY,
                    fontSize: 12.5,
                    fontWeight: 500,
                    padding: "8px 14px",
                    borderRadius: 999,
                    marginBottom: 26,
                  }}>
                    {t("member_price_prefix")} <b>{fmt(period.rateFrom2h)}</b>
                  </span>
                ) : (
                  <div className="price-spacer" style={{ marginBottom: 26, height: 33 }} />
                )}

                <Link
                  href="/book"
                  className="pbtn-primary"
                  style={{
                    marginTop: "auto",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "linear-gradient(180deg,#22b86b,#1a9d5c)",
                    color: "#fff",
                    fontFamily: FONT_FAMILY,
                    fontSize: 14.5,
                    fontWeight: 500,
                    padding: "13px 34px",
                    borderRadius: 999,
                    textDecoration: "none",
                    boxShadow: "0 10px 26px -12px rgba(26,157,92,0.65)",
                  }}
                >
                  {t("cta_book")}
                </Link>
              </div>
            );
          })}
        </div>
      </div>

      <style>{`
        .price-section.is-in .price-card { opacity: 1 !important; transform: none !important; }
        .price-section.is-in .price-card:nth-child(1) { transition-delay: .06s; }
        .price-section.is-in .price-card:nth-child(2) { transition-delay: .18s; }
        .price-section.is-in .price-card:nth-child(3) { transition-delay: .30s; }
        .price-card:hover { border-color: rgba(26,157,92,0.45) !important; box-shadow: 0 22px 46px -24px rgba(17,17,16,0.3) !important; }
        @media (max-width: 860px) {
          .price-grid { grid-template-columns: 1fr !important; gap: 34px 20px !important; max-width: 420px !important; margin: 0 auto !important; }
        }
        @media (max-width: 560px) {
          .price-section { padding: 86px 20px 96px !important; }
          .price-sub { margin-bottom: 44px !important; }
          .price-card { padding: 40px 22px 30px !important; }
        }
        @media (prefers-reduced-motion: reduce) {
          .price-card { opacity: 1 !important; transform: none !important; transition: none !important; }
        }
      `}</style>
    </section>
  );
}