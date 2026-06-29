"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Sun, Zap, Moon } from "lucide-react";
import type { PricingPeriod, ServiceFees } from "@/lib/data/pricing";

const DARK = "#1D1D1F";
const SUBTLE = "#86868B";
const GREEN = "#22C55E";
const BORDER_DARK = "#2D2D2D";
const DIVIDER = "#E5E5E5";

const FONT_FAMILY =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Helvetica, Arial, sans-serif";

const EASE = [0.16, 1, 0.3, 1] as const;
const SPRING = { type: "spring", stiffness: 260, damping: 26 } as const;
const VIEWPORT = { once: true, amount: 0.3 } as const;

const PERIOD_ICON: Record<string, typeof Sun> = {
  afternoon: Sun,
  evening: Zap,
  latenight: Moon,
};

const DURATIONS = [
  { hours: 1, key: "duration_1h" },
  { hours: 2, key: "duration_2h" },
  { hours: 3, key: "duration_3h" },
] as const;

type Benefit = { tier: string; desc: string };
type Service = { name: string; price: string };
type Faq = { q: string; a: string };

function fmt(value: number): string {
  return `HK$${Math.round(value)}`;
}

// ── Section 2 — one full-height tier card with duration pills + animated price ──
function TierCard({ period, index }: { period: PricingPeriod; index: number }) {
  const t = useTranslations("pricingPage");
  const [hours, setHours] = useState(1);
  const Icon = PERIOD_ICON[period.id] ?? Sun;
  const total = period.rate * hours;

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={VIEWPORT}
      transition={{ duration: 0.6, ease: EASE }}
      style={{
        scrollSnapAlign: "start",
        border: `1px solid ${BORDER_DARK}`,
        borderRadius: "24px",
        padding: "clamp(28px, 5vw, 48px)",
        background: "#0A0A0A",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Icon size={32} color={GREEN} strokeWidth={1.5} />

      <h3
        style={{ fontSize: "28px", fontWeight: 700, letterSpacing: "-0.02em", color: "white", margin: "24px 0 4px" }}
        data-cms-key={`pricing.period.${period.id}.title`}
      >
        {t(`period_${period.id}_title`)}
      </h3>
      <p style={{ fontSize: "14px", color: SUBTLE, margin: 0 }} data-cms-key={`pricing.period.${period.id}.time`}>
        {t(`period_${period.id}_time`)}
      </p>

      {/* FLUENT: price is the visual hero */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: "8px", margin: "36px 0 28px" }}>
        <div style={{ height: "72px", overflow: "hidden", display: "flex", alignItems: "flex-end" }}>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={hours}
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -50, opacity: 0 }}
              transition={SPRING}
              style={{ display: "block", fontSize: "72px", fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1, color: "white" }}
              data-cms-key={`pricing.period.${period.id}.price`}
            >
              {fmt(total)}
            </motion.span>
          </AnimatePresence>
        </div>
        <span style={{ fontSize: "14px", color: SUBTLE, paddingBottom: "10px" }} data-cms-key="pricing.per_hour_suffix">
          {hours > 1 ? `· ${fmt(period.rate)}${t("per_hour")}` : t("per_hour")}
        </span>
      </div>

      {/* Duration pills */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "32px" }}>
        {DURATIONS.map((d) => {
          const selected = hours === d.hours;
          return (
            <button
              key={d.hours}
              type="button"
              onClick={() => setHours(d.hours)}
              data-cms-key={`pricing.${d.key}`}
              style={{
                fontSize: "14px",
                fontWeight: 500,
                color: selected ? "#000" : "white",
                background: selected ? "white" : "transparent",
                border: `1px solid ${selected ? "white" : "#3D3D3D"}`,
                borderRadius: "100px",
                padding: "10px 18px",
                cursor: "pointer",
                transition: "all 0.2s ease",
                fontFamily: FONT_FAMILY,
                minHeight: 44,
              }}
            >
              {t(d.key)}
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: "auto", display: "flex", gap: "24px", flexWrap: "wrap", alignItems: "center" }}>
        <Link
          href="/book"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: GREEN,
            color: "#000",
            fontWeight: 700,
            fontSize: "15px",
            padding: "0 24px",
            height: "48px",
            borderRadius: "100px",
            textDecoration: "none",
          }}
          data-cms-key="pricing.cta_book"
        >
          {t("cta_book")}
        </Link>
        <a
          href="#breakdown"
          style={{ color: GREEN, fontSize: "15px", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "4px" }}
          data-cms-key="pricing.cta_details"
        >
          {t("cta_details")} <span aria-hidden="true">›</span>
        </a>
      </div>
    </motion.div>
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
  const benefits = t.raw("benefits") as Benefit[];
  const serviceRows = t.raw("services") as Service[];
  const faqs = t.raw("faqs") as Faq[];
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div style={{ fontFamily: FONT_FAMILY }}>
      {/* ── Section 1 — Hero (black) ── */}
      <section
        data-nav-theme="dark"
        style={{ background: "#000", color: "white", padding: "160px 24px 80px", textAlign: "center" }}
      >
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
          style={{ fontSize: "clamp(44px, 9vw, 72px)", fontWeight: 700, letterSpacing: "-0.03em", margin: 0 }}
          data-cms-key="pricing.hero_title"
        >
          {t("hero_title")}
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE, delay: 0.1 }}
          style={{ fontSize: "19px", color: "rgba(255,255,255,0.6)", margin: "20px 0 0" }}
          data-cms-key="pricing.hero_subtitle"
        >
          {t("hero_subtitle")}
        </motion.p>
      </section>

      {/* ── Section 2 — Tier cards (black) ── */}
      <section
        data-nav-theme="dark"
        style={{ background: "#000", padding: "0 24px 96px" }}
      >
        <div
          style={{
            maxWidth: "1100px",
            margin: "0 auto",
            display: "grid",
            gap: "20px",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          }}
        >
          {periods.map((p, i) => (
            <TierCard key={p.id} period={p} index={i} />
          ))}
        </div>
      </section>

      {/* ── Section 3 — Full breakdown (white) ── */}
      <section
        id="breakdown"
        data-nav-theme="light"
        style={{ background: "#F5F5F7", color: DARK, padding: "clamp(72px, 10vw, 120px) 24px" }}
      >
        <div style={{ maxWidth: "820px", margin: "0 auto" }}>
          <h2
            style={{ fontSize: "clamp(32px, 5vw, 48px)", fontWeight: 700, letterSpacing: "-0.02em", margin: "0 0 40px" }}
            data-cms-key="pricing.breakdown_title"
          >
            {t("breakdown_title")}
          </h2>

          <div style={{ border: `1px solid ${DIVIDER}`, borderRadius: "16px", overflow: "hidden", background: "white" }}>
            {/* header row — hidden on mobile, shown as table head on >=sm */}
            <div
              className="pricing-breakdown-head"
              style={{
                display: "grid",
                gridTemplateColumns: "1.2fr 1.5fr auto",
                gap: "16px",
                padding: "16px 20px",
                background: "#F5F5F7",
                fontSize: "13px",
                fontWeight: 600,
                color: SUBTLE,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              <span data-cms-key="pricing.breakdown_period">{t("breakdown_period")}</span>
              <span data-cms-key="pricing.breakdown_time">{t("breakdown_time")}</span>
              <span style={{ textAlign: "right" }} data-cms-key="pricing.breakdown_rate">{t("breakdown_rate")}</span>
            </div>
            {periods.map((p) => (
              <div
                key={p.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.2fr 1.5fr auto",
                  gap: "16px",
                  alignItems: "center",
                  padding: "18px 20px",
                  borderTop: `1px solid ${DIVIDER}`,
                }}
              >
                <span style={{ fontWeight: 600, fontSize: "16px" }} data-cms-key={`pricing.breakdown.${p.id}.name`}>
                  {t(`period_${p.id}_title`)}
                </span>
                <span style={{ fontSize: "15px", color: "#494951" }} data-cms-key={`pricing.breakdown.${p.id}.time`}>
                  {t(`period_${p.id}_time`)}
                </span>
                <span style={{ textAlign: "right", fontWeight: 700, fontSize: "17px", color: GREEN }} data-cms-key={`pricing.breakdown.${p.id}.rate`}>
                  {fmt(p.rate)}
                  <span style={{ fontSize: "13px", color: SUBTLE, fontWeight: 400 }}>{t("per_hour")}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 4 — Member benefits (black) ── */}
      <section
        data-nav-theme="dark"
        style={{ background: "#000", color: "white", padding: "clamp(72px, 10vw, 120px) 24px" }}
      >
        <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
          <h2
            style={{ fontSize: "clamp(32px, 5vw, 48px)", fontWeight: 700, letterSpacing: "-0.02em", margin: "0 0 48px", textAlign: "center" }}
            data-cms-key="pricing.benefits_title"
          >
            {t("benefits_title")}
          </h2>
          <div style={{ display: "grid", gap: "16px", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
            {benefits.map((b, i) => (
              <motion.div
                key={b.tier}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={VIEWPORT}
                transition={{ duration: 0.5, ease: EASE, delay: i * 0.08 }}
                style={{ border: `1px solid ${BORDER_DARK}`, borderRadius: "20px", padding: "32px", background: "#0A0A0A" }}
              >
                <h3 style={{ fontSize: "22px", fontWeight: 700, margin: "0 0 12px" }} data-cms-key={`pricing.benefit.${i}.tier`}>
                  {b.tier}
                </h3>
                <p style={{ fontSize: "16px", lineHeight: 1.6, color: "rgba(255,255,255,0.7)", margin: 0 }} data-cms-key={`pricing.benefit.${i}.desc`}>
                  {b.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 5 — Additional services (dark gray) ── */}
      <section
        data-nav-theme="dark"
        style={{ background: "#1C1C1E", color: "white", padding: "clamp(72px, 10vw, 120px) 24px" }}
      >
        <div style={{ maxWidth: "820px", margin: "0 auto" }}>
          <h2
            style={{ fontSize: "clamp(32px, 5vw, 48px)", fontWeight: 700, letterSpacing: "-0.02em", margin: "0 0 40px" }}
            data-cms-key="pricing.services_title"
          >
            {t("services_title")}
          </h2>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {serviceRows.map((s, i) => (
              <div
                key={s.name}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "16px",
                  padding: "20px 0",
                  borderBottom: i < serviceRows.length - 1 ? `1px solid ${BORDER_DARK}` : "none",
                }}
              >
                <span style={{ fontSize: "17px", fontWeight: 500 }} data-cms-key={`pricing.service.${i}.name`}>{s.name}</span>
                <span style={{ fontSize: "16px", color: "rgba(255,255,255,0.7)", textAlign: "right" }} data-cms-key={`pricing.service.${i}.price`}>
                  {s.price}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 6 — FAQ (white) ── */}
      <section
        data-nav-theme="light"
        style={{ background: "#fff", color: DARK, padding: "clamp(72px, 10vw, 120px) 24px" }}
      >
        <div style={{ maxWidth: "760px", margin: "0 auto" }}>
          <h2
            style={{ fontSize: "clamp(32px, 5vw, 48px)", fontWeight: 700, letterSpacing: "-0.02em", margin: "0 0 32px" }}
            data-cms-key="pricing.faq_title"
          >
            {t("faq_title")}
          </h2>
          <div>
            {faqs.map((f, i) => {
              const isOpen = openFaq === i;
              return (
                <details key={f.q} open={isOpen} style={{ borderBottom: `1px solid ${DIVIDER}` }}>
                  <summary
                    onClick={(e) => {
                      e.preventDefault();
                      setOpenFaq((prev) => (prev === i ? null : i));
                    }}
                    style={{
                      listStyle: "none",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "24px",
                      padding: "24px 4px",
                      userSelect: "none",
                    }}
                  >
                    <span style={{ fontSize: "17px", fontWeight: 500, color: DARK }} data-cms-key={`pricing.faq.${i}.q`}>
                      {f.q}
                    </span>
                    <motion.span
                      aria-hidden="true"
                      animate={{ rotate: isOpen ? 90 : 0 }}
                      transition={{ duration: 0.3, ease: EASE }}
                      style={{ flexShrink: 0, color: SUBTLE, fontSize: "22px", lineHeight: 1 }}
                    >
                      ›
                    </motion.span>
                  </summary>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        key="a"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.35, ease: EASE }}
                        style={{ overflow: "hidden" }}
                      >
                        <p style={{ fontSize: "16px", lineHeight: 1.6, color: "#494951", margin: 0, padding: "0 4px 28px" }} data-cms-key={`pricing.faq.${i}.a`}>
                          {f.a}
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

      {/* ── CTA section (black) ── */}
      <section
        data-nav-theme="dark"
        style={{ background: "#000", color: "white", padding: "clamp(72px, 10vw, 120px) 24px", textAlign: "center" }}
      >
        <h2
          style={{ fontSize: "clamp(32px, 6vw, 56px)", fontWeight: 700, letterSpacing: "-0.02em", margin: "0 0 32px" }}
          data-cms-key="pricing.cta_section_title"
        >
          {t("cta_section_title")}
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
            fontSize: "17px",
            padding: "0 40px",
            height: "56px",
            borderRadius: "100px",
            textDecoration: "none",
          }}
          data-cms-key="pricing.cta_section_button"
        >
          {t("cta_section_button")}
        </Link>
      </section>
    </div>
  );
}
