"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Coins, TrendingUp, Gift, LayoutDashboard } from "lucide-react";
import { CMSText } from "@/components/cms/CMSText";
import Member from "@/components/landing/Member";

const GREEN = "#22C55E";

const FONT_FAMILY =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Helvetica, Arial, sans-serif";

const EASE = [0.16, 1, 0.3, 1] as const;
const VIEWPORT = { once: true, amount: 0.25 } as const;

const HOW_ICONS = [Coins, TrendingUp, Gift, LayoutDashboard];

type HowItem = { title: string; body: string };

// Public membership page — no login required. Section 1 reuses the landing
// Member tier cards verbatim; Section 2 explains how points work. Deliberately
// NO spending-to-tier conversion tables (points thresholds only, per spec).
export default function MembershipContent() {
  const t = useTranslations("membershipPage");
  const howItems = t.raw("how_items") as HowItem[];

  return (
    <div style={{ fontFamily: FONT_FAMILY }}>
      {/* ── Hero — black ── */}
      <section
        data-nav-theme="dark"
        style={{
          background: "#000",
          color: "#fff",
          padding: "clamp(140px, 22vh, 220px) 24px clamp(48px, 8vh, 80px)",
          textAlign: "center",
        }}
      >
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE }}
          style={{
            fontSize: "clamp(44px, 9vw, 84px)",
            fontWeight: 700,
            letterSpacing: "-0.03em",
            margin: 0,
            lineHeight: 1.05,
          }}
          data-cms-key="membership.hero_title"
        >
          <CMSText k="membershipPage.hero_title">{t("hero_title")}</CMSText>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.15 }}
          style={{
            fontSize: "clamp(17px, 3vw, 22px)",
            color: "rgba(255,255,255,0.75)",
            margin: "20px auto 0",
            maxWidth: "560px",
          }}
          data-cms-key="membership.hero_subtitle"
        >
          <CMSText k="membershipPage.hero_subtitle">{t("hero_subtitle")}</CMSText>
        </motion.p>
      </section>

      {/* ── Section 1 — 你在哪一個階段 (reuses landing tier cards) ── */}
      <section data-nav-theme="dark" style={{ background: "#000" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 0 24px" }}>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={VIEWPORT}
            transition={{ duration: 0.6, ease: EASE }}
            style={{
              fontSize: "clamp(28px, 4.5vw, 44px)",
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: "#fff",
              margin: 0,
              padding: "0 24px",
              textAlign: "center",
            }}
            data-cms-key="membership.stage_title"
          >
            <CMSText k="membershipPage.stage_title">{t("stage_title")}</CMSText>
          </motion.h2>
        </div>
        <Member />
      </section>

      {/* ── Section 2 — 玩法介紹 (white) ── */}
      <section
        data-nav-theme="light"
        style={{
          background: "#fff",
          color: "#1D1D1F",
          padding: "clamp(80px, 10vw, 130px) 24px",
        }}
      >
        <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={VIEWPORT}
            transition={{ duration: 0.6, ease: EASE }}
            style={{
              fontSize: "clamp(32px, 5vw, 48px)",
              fontWeight: 700,
              letterSpacing: "-0.02em",
              margin: "0 0 48px",
            }}
            data-cms-key="membership.how_title"
          >
            <CMSText k="membershipPage.how_title">{t("how_title")}</CMSText>
          </motion.h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "20px",
            }}
          >
            {howItems.map((item, i) => {
              const Icon = HOW_ICONS[i] ?? Coins;
              return (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={VIEWPORT}
                  transition={{ duration: 0.5, ease: EASE, delay: i * 0.06 }}
                  style={{
                    border: "1px solid #d2d2d7",
                    borderRadius: "20px",
                    padding: "32px 28px",
                  }}
                >
                  <Icon size={30} color={GREEN} strokeWidth={1.6} style={{ marginBottom: 18 }} />
                  <h3 style={{ fontSize: "20px", fontWeight: 600, margin: "0 0 8px" }}>
                    {item.title}
                  </h3>
                  <p style={{ fontSize: "16px", color: "#6e6e73", lineHeight: 1.6, margin: 0 }}>
                    {item.body}
                  </p>
                </motion.div>
              );
            })}
          </div>

          <div
            style={{
              display: "flex",
              gap: "12px",
              justifyContent: "center",
              flexWrap: "wrap",
              marginTop: "56px",
            }}
          >
            <Link
              href="/book"
              data-cms-key="membership.cta_book"
              style={{
                display: "inline-flex",
                alignItems: "center",
                minHeight: "48px",
                padding: "0 28px",
                borderRadius: "100px",
                background: GREEN,
                color: "#000",
                fontSize: "16px",
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              <CMSText k="membershipPage.cta_book">{t("cta_book")}</CMSText>
            </Link>
            <a
              href="/member"
              data-cms-key="membership.cta_login"
              style={{
                display: "inline-flex",
                alignItems: "center",
                minHeight: "48px",
                padding: "0 28px",
                borderRadius: "100px",
                border: "1px solid #d2d2d7",
                color: "#1D1D1F",
                fontSize: "16px",
                fontWeight: 500,
                textDecoration: "none",
              }}
            >
              <CMSText k="membershipPage.cta_login">{t("cta_login")}</CMSText>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
