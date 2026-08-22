"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Circle, Triangle, Target } from "lucide-react";
import PeriodPricingSections from "@/components/pricing/PeriodPricingSections";
import type { PricingPeriod, ServiceFees } from "@/lib/data/pricing";

const GREEN = "#22c55e";
const PURPLE = "#a855f7";
const PINK = "#ec4899";
const SUBTLE = "#a1a1a6"; // dark-section secondary text (raised from #86868b for #000 legibility)
const EASE = [0.16, 1, 0.3, 1] as const;
const SPRING = { type: "spring", stiffness: 300, damping: 30 } as const;

const FONT_FAMILY =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Helvetica, Arial, sans-serif";
const DISPLAY_FONT = "var(--font-bebas), 'Bebas Neue', sans-serif";

// Highlighter mark component — Apple's inline highlight effect
function Mark({ children, color = GREEN }: { children: React.ReactNode; color?: string }) {
  return (
    <span
      style={{
        background: color,
        color: "#000",
        padding: "0 8px",
        display: "inline",
        boxDecorationBreak: "clone",
        WebkitBoxDecorationBreak: "clone",
      }}
    >
      {children}
    </span>
  );
}

// Floating snooker icons — scattered irregularly like Apple's app icon collage
function FloatingIcons() {
  const icons = [
    { Icon: Circle, size: 48, top: "15%", left: "8%", rotate: 12, color: GREEN },
    { Icon: Triangle, size: 64, top: "45%", right: "12%", rotate: -8, color: PURPLE },
    { Icon: Target, size: 56, bottom: "20%", left: "15%", rotate: 15, color: PINK },
    { Icon: Circle, size: 40, top: "70%", right: "20%", rotate: -12, color: GREEN },
    { Icon: Triangle, size: 52, top: "25%", right: "25%", rotate: 20, color: PINK },
  ];

  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none",
        opacity: 0.15,
      }}
    >
      {icons.map((props, i) => {
        const { Icon, size, top, left, right, bottom, rotate, color } = props;
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.8, rotate: 0 }}
            whileInView={{ opacity: 1, scale: 1, rotate }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 1.2, ease: EASE, delay: i * 0.1 }}
            style={{
              position: "absolute",
              top,
              left,
              right,
              bottom,
              willChange: "opacity, transform",
            }}
          >
            <Icon size={size} color={color} strokeWidth={1.5} />
          </motion.div>
        );
      })}
    </div>
  );
}

export default function PricingContent({
  periods,
  services,
}: {
  periods: PricingPeriod[];
  services: ServiceFees;
}) {
  const t = useTranslations("pricingPage");
  const faqs = t.raw("faqs") as Array<{ q: string; a: string }>;
  const carouselRef = useRef<HTMLDivElement>(null);


  return (
    <div style={{ fontFamily: FONT_FAMILY }}>
      {/* ── Part 1: Hero — WHITE background, black text (Apple rhythm) ── */}
      <section
        data-nav-theme="light"
        style={{
          background: "#fff",
          color: "#1d1d1f",
          padding: "clamp(120px, 15vh, 180px) 24px clamp(80px, 12vh, 120px)",
          textAlign: "center",
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: EASE }}
          style={{
            maxWidth: "1100px",
            margin: "0 auto",
            willChange: "opacity, transform",
          }}
        >
          <h1
            className="font-label"
            style={{
              fontFamily: DISPLAY_FONT,
              fontSize: "clamp(20px, 4vw, 32px)",
              fontWeight: 400,
              color: "#86868b",
              margin: "0 0 16px",
            }}
          >
            {t("hero_eyebrow")}
          </h1>

          <h2
            style={{
              fontSize: "clamp(48px, 10vw, 96px)",
              fontWeight: 700,
              letterSpacing: "-0.03em",
              lineHeight: 1.05,
              margin: 0,
              color: "#1d1d1f",
            }}
          >
            {t("hero_line1")}
          </h2>

          <p
            style={{
              fontSize: "clamp(28px, 6vw, 56px)",
              fontWeight: 600,
              letterSpacing: "-0.02em",
              lineHeight: 1.2,
              margin: "32px 0 0",
              color: "#1d1d1f",
            }}
          >
            {t("hero_line2_before")}
            <br />
            <Mark color={GREEN}>
              {t("hero_line2_highlight")}
            </Mark>
          </p>
        </motion.div>
      </section>

      {/* ── Part 2: Sectioned Pricing — shared with the homepage ── */}
      <PeriodPricingSections periods={periods} />

      {/* ── Part 3: Floating icons collage — BLACK background for atmosphere ── */}
      <section
        data-nav-theme="dark"
        style={{
          position: "relative",
          background: "#000",
          color: "#fff",
          padding: "clamp(100px, 15vh, 180px) 24px",
          overflow: "hidden",
        }}
      >
        <FloatingIcons />
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.8, ease: EASE }}
          style={{
            position: "relative",
            zIndex: 1,
            textAlign: "center",
            maxWidth: "820px",
            margin: "0 auto",
            willChange: "opacity, transform",
          }}
        >
          <h2
            style={{
              fontSize: "clamp(40px, 8vw, 72px)",
              fontWeight: 700,
              letterSpacing: "-0.02em",
              lineHeight: 1.1,
              margin: 0,
            }}
          >
            {t("time_line1")}
            <br />
            <Mark color={GREEN}>
              {t("time_line2")}
            </Mark>
          </h2>
        </motion.div>
      </section>

      {/* ── Part 4: Black card FAQ carousel — BLACK background (continuation) ── */}
      <section
        data-nav-theme="dark"
        style={{
          background: "#000",
          color: "#fff",
          padding: "clamp(100px, 15vh, 160px) 0",
        }}
      >
        <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "0 24px" }}>
          <motion.h2
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: EASE }}
            style={{
              fontSize: "clamp(32px, 6vw, 56px)",
              fontWeight: 700,
              letterSpacing: "-0.02em",
              margin: "0 0 56px",
              textAlign: "center",
              willChange: "opacity, transform",
            }}
          >
            {t("faq_title")}
          </motion.h2>

          <div
            ref={carouselRef}
            className="hscroll-track"
            style={{
              display: "flex",
              gap: 24,
              overflowX: "auto",
              scrollSnapType: "x mandatory",
              paddingBottom: 24,
              scrollbarWidth: "none",
              msOverflowStyle: "none",
            }}
          >
            {faqs.map((faq, i) => {
              // Keyword color cycling — green, purple, pink
              const keywordColor = [GREEN, PURPLE, PINK][i % 3];

              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: 40 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.5, ease: EASE, delay: i * 0.08 }}
                  style={{
                    flex: "0 0 clamp(280px, 85vw, 400px)",
                    scrollSnapAlign: "start",
                    background: "#000",
                    border: "1px solid #1a1a1a",
                    borderRadius: 24,
                    padding: "clamp(32px, 6vw, 48px)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 20,
                  }}
                >
                  <h3
                    style={{
                      fontSize: "clamp(24px, 5vw, 32px)",
                      fontWeight: 700,
                      letterSpacing: "-0.01em",
                      lineHeight: 1.2,
                      margin: 0,
                    }}
                  >
                    {/* Simple keyword highlighting — first word gets color */}
                    {faq.q.split(" ").map((word, wi) => (
                      <span key={wi} style={{ color: wi === 0 ? keywordColor : "#fff" }}>
                        {word}{wi < faq.q.split(" ").length - 1 ? " " : ""}
                      </span>
                    ))}
                  </h3>
                  <p
                    style={{
                      fontSize: "clamp(15px, 3vw, 17px)",
                      lineHeight: 1.5,
                      color: "rgba(255,255,255,0.7)",
                      margin: 0,
                    }}
                  >
                    {faq.a}
                  </p>
                </motion.div>
              );
            })}
          </div>

          {/* Scroll hint */}
          <p
            style={{
              textAlign: "center",
              fontSize: 14,
              color: SUBTLE,
              margin: "32px 0 0",
            }}
          >
            {t("faq_scroll_hint")}
          </p>
        </div>
      </section>

      {/* ── Part 5: CTA finale — WHITE background (bookend with hero) ── */}
      <section
        data-nav-theme="light"
        style={{
          background: "#fff",
          color: "#1d1d1f",
          padding: "clamp(120px, 18vh, 200px) 24px clamp(100px, 15vh, 160px)",
          textAlign: "center",
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.8, ease: EASE }}
          style={{ willChange: "opacity, transform" }}
        >
          <Circle
            size={80}
            color={GREEN}
            strokeWidth={2}
            style={{ margin: "0 auto 48px", display: "block" }}
          />

          <h2
            style={{
              fontSize: "clamp(40px, 8vw, 72px)",
              fontWeight: 700,
              letterSpacing: "-0.02em",
              lineHeight: 1.1,
              margin: "0 0 48px",
              color: "#1d1d1f",
            }}
          >
            {t("cta_line1")}
            <br />
            <Mark color={GREEN}>
              {t("cta_line2")}
            </Mark>
          </h2>

          <Link
            href="/book"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              background: GREEN,
              color: "#000",
              fontWeight: 700,
              fontSize: "clamp(16px, 3.5vw, 20px)",
              padding: "0 clamp(40px, 6vw, 56px)",
              height: "clamp(56px, 11vw, 72px)",
              borderRadius: "100px",
              textDecoration: "none",
              transition: "transform 0.2s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
            onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
          >
            {t("cta_button")}
          </Link>
        </motion.div>
      </section>
    </div>
  );
}
