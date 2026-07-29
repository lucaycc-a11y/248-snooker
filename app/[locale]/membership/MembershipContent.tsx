"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import Member from "@/components/landing/Member";
import PlayIntro from "@/components/landing/PlayIntro";

const FONT_FAMILY =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Helvetica, Arial, sans-serif";

const EASE = [0.16, 1, 0.3, 1] as const;
const VIEWPORT = { once: true, amount: 0.25 } as const;

// Public membership page — no login required. Section 1 reuses the landing
// Member tier cards verbatim; Section 2 explains how points work.
// Hero section removed per redesign — page now starts directly with 會員制度.
export default function MembershipContent() {
  const t = useTranslations("membershipPage");

  return (
    <div style={{ fontFamily: FONT_FAMILY }}>
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
          >
            {t("stage_title")}
          </motion.h2>
        </div>
        <Member />
      </section>

      {/* ── Section 2 — 玩法介紹 (white, production reference) ── */}
      <PlayIntro />
    </div>
  );
}