"use client";

import { useEffect, useRef, useState } from "react";
import { Link } from "@/i18n/navigation";
import { tokens } from "@/app/styles/tokens";

const FONT_FAMILY =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Noto Sans TC', 'Helvetica Neue', Helvetica, Arial, sans-serif";

const HOW_TO_GO_CSS = `
.how-to-go-section.is-in .how-to-go-card { opacity: 1 !important; transform: none !important; }
.how-to-go-section.is-in .how-to-go-map { opacity: 1 !important; transform: none !important; }

.how-to-go-notes li::before {
  content: "";
  position: absolute;
  left: 1px;
  top: 0.72em;
  width: 5px;
  height: 5px;
  border-radius: 50%;
}

.how-to-go-light .how-to-go-notes li::before {
  background: #1a9d5c;
}

.how-to-go-dark .how-to-go-notes li::before {
  background: #16a34a;
}

.how-to-go-pin-body {
  transform-box: fill-box;
  transform-origin: center;
  animation: htgPinBreathe 3s ease-in-out infinite;
}

.how-to-go-pin-dot {
  transform-box: fill-box;
  transform-origin: center;
  animation: htgPinBounce 2.4s ease-in-out infinite;
}

@keyframes htgPinBreathe {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.06); }
}

@keyframes htgPinBounce {
  0%, 100% { transform: translateY(0); }
  40% { transform: translateY(-2px); }
  60% { transform: translateY(0.5px); }
}

@media (max-width: 880px) {
  .how-to-go-layout { grid-template-columns: 1fr !important; gap: 24px !important; }
  .how-to-go-card { padding: 34px 28px 36px !important; }
  .how-to-go-map { aspect-ratio: 4 / 3; min-height: 0 !important; }
}

@media (max-width: 560px) {
  .how-to-go-section { padding: 80px 24px 96px !important; }
  .how-to-go-card { padding: 24px !important; border-radius: 18px !important; }
  .how-to-go-header { gap: 12px !important; margin-bottom: 20px !important; }
  .how-to-go-pin { width: 30px !important; height: 30px !important; }
  .how-to-go-map { border-radius: 16px !important; }
  .how-to-go-actions { gap: 10px !important; flex-direction: column !important; }
  .how-to-go-btn { padding: 13px 20px !important; font-size: 13.5px !important; width: 100% !important; justify-content: center !important; min-height: 48px !important; }
  .how-to-go-notes { margin-bottom: 24px !important; }
}

@media (prefers-reduced-motion: reduce) {
  .how-to-go-card, .how-to-go-map { opacity: 1 !important; transform: none !important; }
  .how-to-go-pin-body, .how-to-go-pin-dot { animation: none !important; }
}
`;

type HowToGoProps = {
  theme?: "light" | "dark";
  heading: string;
  address: string;
  directions: string[];
  primaryCta: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
  map?: { embedUrl?: string };
  className?: string;
};

export default function HowToGo({
  theme = "light",
  heading,
  address,
  directions,
  primaryCta,
  secondaryCta,
  map,
  className,
}: HowToGoProps) {
  const secRef = useRef<HTMLElement>(null);
  const [isIn, setIsIn] = useState(false);

  const isDark = theme === "dark";

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
      { threshold: 0.15, rootMargin: "0px 0px -6% 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const bgColor = isDark ? tokens.colors.bg : "#ffffff";
  const cardBg = isDark ? tokens.colors.surface : "#ffffff";
  const cardBorder = isDark ? tokens.colors.border : "rgba(17,17,16,0.14)";
  const textColor = isDark ? tokens.colors.text : "#111110";
  const textMuted = isDark ? tokens.colors.textMuted : "rgba(17,17,16,0.58)";
  const accentColor = isDark ? "#16a34a" : "#1a9d5c";
  const accentHover = isDark ? "#15803d" : "#15803d";
  const buttonGradient = isDark
    ? `linear-gradient(180deg,${accentColor},${accentHover})`
    : "linear-gradient(180deg,#22b86b,#1a9d5c)";
  const ghostBorder = isDark ? "rgba(255,255,255,0.18)" : "rgba(17,17,16,0.22)";
  const ghostText = isDark ? tokens.colors.text : "#111110";

  return (
    <section
      ref={secRef}
      className={`how-to-go-section how-to-go-${theme} ${isIn ? "is-in" : ""} ${className || ""}`}
      data-nav-theme={isDark ? "dark" : "light"}
      style={{
        background: bgColor,
        padding: "120px 24px 140px",
      }}
    >
      <div
        className="how-to-go-inner"
        style={{ maxWidth: 1100, margin: "0 auto" }}
      >
        <div
          className="how-to-go-layout"
          style={{
            display: "grid",
            gridTemplateColumns: map ? "1fr 0.85fr" : "1fr",
            gap: 34,
            alignItems: "stretch",
          }}
        >
          {/* Left: info card */}
          <div
            className="how-to-go-card"
            style={{
              background: cardBg,
              border: `1px solid ${cardBorder}`,
              borderRadius: 20,
              padding: "42px 40px 44px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              opacity: 0,
              transform: "translateY(20px) scale(0.96)",
              transition:
                "opacity .55s cubic-bezier(.2,.7,.3,1), transform .55s cubic-bezier(.2,.7,.3,1)",
            }}
          >
            <div
              className="how-to-go-header"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                marginBottom: 28,
              }}
            >
              <div
                className="how-to-go-pin"
                style={{
                  flexShrink: 0,
                  width: 38,
                  height: 38,
                  color: accentColor,
                }}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    width: "100%",
                    height: "100%",
                    display: "block",
                  }}
                >
                  <path
                    className="how-to-go-pin-body"
                    d="M20 10.5c0 5.4-8 12-8 12s-8-6.6-8-12a8 8 0 0 1 16 0z"
                  />
                  <circle className="how-to-go-pin-dot" cx="12" cy="10.3" r="3" />
                </svg>
              </div>
              <h2
                className="how-to-go-title"
                style={{
                  fontFamily: FONT_FAMILY,
                  fontWeight: 900,
                  fontSize: "clamp(1.4rem, 2.8vw, 1.95rem)",
                  color: textColor,
                  lineHeight: 1.2,
                }}
              >
                {heading}
              </h2>
            </div>

            <p
              className="how-to-go-address"
              style={{
                fontFamily: FONT_FAMILY,
                fontWeight: 700,
                fontSize: "clamp(16px, 1.9vw, 19px)",
                lineHeight: 1.6,
                color: textColor,
                marginBottom: 14,
              }}
            >
              {address}
            </p>

            <ul
              className="how-to-go-notes"
              style={{
                listStyle: "none",
                marginBottom: 30,
                padding: 0,
              }}
            >
              {directions.map((direction: string, index: number) => (
                <li
                  key={index}
                  style={{
                    position: "relative",
                    paddingLeft: 17,
                    fontFamily: FONT_FAMILY,
                    fontSize: 13.8,
                    lineHeight: 1.75,
                    color: textMuted,
                    marginTop: index === 0 ? 0 : 8,
                  }}
                >
                  {direction}
                </li>
              ))}
            </ul>

            <div
              className="how-to-go-actions"
              style={{
                display: "flex",
                gap: 14,
                flexWrap: "wrap",
              }}
            >
              <a
                className="how-to-go-btn primary"
                href={primaryCta.href}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 9,
                  fontFamily: FONT_FAMILY,
                  fontSize: 14.5,
                  fontWeight: 500,
                  padding: "14px 26px",
                  borderRadius: 999,
                  textDecoration: "none",
                  cursor: "pointer",
                  background: buttonGradient,
                  color: "#ffffff",
                  border: "none",
                  minHeight: 44,
                }}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ width: 17, height: 17, flexShrink: 0 }}
                >
                  <path d="M20 10.5c0 5.4-8 12-8 12s-8-6.6-8-12a8 8 0 0 1 16 0z" />
                  <circle cx="12" cy="10.3" r="3" />
                </svg>
                {primaryCta.label}
              </a>
              {secondaryCta && (
                <Link
                  href={secondaryCta.href}
                  className="how-to-go-btn ghost"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 9,
                    fontFamily: FONT_FAMILY,
                    fontSize: 14.5,
                    fontWeight: 500,
                    padding: "14px 26px",
                    borderRadius: 999,
                    textDecoration: "none",
                    cursor: "pointer",
                    background: "transparent",
                    color: ghostText,
                    border: `1px solid ${ghostBorder}`,
                    minHeight: 44,
                  }}
                >
                  {secondaryCta.label}
                </Link>
              )}
            </div>
          </div>

          {/* Right: map (optional) */}
          {map && (
            <div
              className="how-to-go-map"
              style={{
                position: "relative",
                border: `1px solid ${cardBorder}`,
                borderRadius: 20,
                overflow: "hidden",
                background: isDark ? tokens.colors.surface : "#eceae5",
                minHeight: 380,
                opacity: 0,
                transform: "translateY(20px) scale(0.96)",
                transition:
                  "opacity .55s cubic-bezier(.2,.7,.3,1) .15s, transform .55s cubic-bezier(.2,.7,.3,1) .15s",
              }}
            >
              <iframe
                src={map.embedUrl}
                title="SPACE8 location map"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  border: 0,
                  display: "block",
                }}
              />
            </div>
          )}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: HOW_TO_GO_CSS }} />
    </section>
  );
}
