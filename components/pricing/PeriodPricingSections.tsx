"use client";

// Shared per-period pricing sections — the /pricing page's "Part 2" blocks,
// extracted so the homepage reuses the exact same component (spec: the home
// pricing section IS the pricing page's, not a rewrite). Rates flow from the
// `config` table via getConfig() — never hardcoded here.

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Sun, Zap, Moon } from "lucide-react";
import { CMSText } from "@/components/cms/CMSText";
import type { PricingPeriod } from "@/lib/data/pricing";

const GREEN = "#22c55e";
const EASE = [0.16, 1, 0.3, 1] as const;

const FONT_FAMILY =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Helvetica, Arial, sans-serif";

function fmt(value: number): string {
  return `HK$${Math.round(value)}`;
}

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

export default function PeriodPricingSections({ periods }: { periods: PricingPeriod[] }) {
  const t = useTranslations("pricingPage");

  return (
    <div style={{ fontFamily: FONT_FAMILY }}>
      {periods.map((period) => {
        const Icon = period.id === "morning" ? Sun : period.id === "afternoon" ? Zap : Moon;

        return (
          <section
            key={period.id}
            data-nav-theme="light"
            style={{
              background: "#fff",
              color: "#1d1d1f",
              padding: "clamp(80px, 12vh, 140px) 24px",
              borderTop: "1px solid #d2d2d7",
            }}
          >
            <div style={{ maxWidth: "820px", margin: "0 auto" }}>
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 0.7, ease: EASE }}
                style={{ textAlign: "center", willChange: "opacity, transform" }}
              >
                <Icon size={48} color={GREEN} strokeWidth={1.5} style={{ marginBottom: 24 }} />

                <h3
                  style={{
                    fontSize: "clamp(40px, 8vw, 72px)",
                    fontWeight: 700,
                    letterSpacing: "-0.02em",
                    margin: "0 0 16px",
                    color: "#1d1d1f",
                  }}
                  data-cms-key={`pricing.period.${period.id}.title`}
                >
                  <CMSText k={`pricingPage.period.${period.id}.title`}>
                    {t(`period_${period.id}_title`)}
                  </CMSText>
                </h3>

                <p
                  style={{
                    fontSize: "clamp(20px, 4vw, 28px)",
                    color: "#6e6e73",
                    margin: "0 0 48px",
                  }}
                  data-cms-key={`pricing.period.${period.id}.time`}
                >
                  <CMSText k={`pricingPage.period.${period.id}.time`}>
                    {t(`period_${period.id}_time`)}
                  </CMSText>
                </p>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 12,
                    marginBottom: 48,
                  }}
                >
                  <div
                    style={{
                      fontSize: "clamp(56px, 12vw, 96px)",
                      fontWeight: 700,
                      letterSpacing: "-0.03em",
                      color: "#1d1d1f",
                    }}
                  >
                    {fmt(period.rate)}
                    <span style={{ fontSize: "clamp(20px, 4vw, 32px)", color: "#6e6e73", fontWeight: 400 }}>
                      {" "}
                      <CMSText k="pricingPage.per_hour">{t("per_hour")}</CMSText>
                    </span>
                  </div>

                  {period.rateFrom2h !== undefined && (
                    <div
                      style={{
                        fontSize: "clamp(24px, 5vw, 40px)",
                        fontWeight: 600,
                        letterSpacing: "-0.01em",
                      }}
                    >
                      <Mark color={GREEN}>
                        <CMSText k="pricingPage.member_price_prefix">{t("member_price_prefix")}</CMSText>{" "}
                        {fmt(period.rateFrom2h)}
                      </Mark>
                    </div>
                  )}
                </div>

                <Link
                  href="/book"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: GREEN,
                    color: "#000",
                    fontWeight: 700,
                    fontSize: "clamp(15px, 3vw, 19px)",
                    padding: "0 clamp(32px, 5vw, 48px)",
                    height: "clamp(52px, 10vw, 64px)",
                    borderRadius: "100px",
                    textDecoration: "none",
                    transition: "transform 0.2s ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
                  onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
                  data-cms-key="pricing.cta_book"
                >
                  <CMSText k="pricingPage.cta_book">{t("cta_book")}</CMSText>
                </Link>
              </motion.div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
