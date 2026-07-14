"use client";

// Public, no-login-required view of /member (item 七 of the spec). Shown
// instead of redirecting to /login when there's no session. Reuses the same
// tier-card copy as the homepage's <Member> section (same `member` i18n
// namespace) plus a "玩法介紹" (how it works) section. Deliberately does NOT
// include any spending→points $ conversion table — the spec explicitly
// requires that be absent here.

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { CMSText } from "@/components/cms/CMSText";
import Nav from "@/components/layout/Nav";
import Footer from "@/components/layout/Footer";

const DARK = "#1D1D1F";
const GREEN = "#22C55E";
const FONT_FAMILY =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Helvetica, Arial, sans-serif";
const EASE = [0.16, 1, 0.3, 1] as const;
const VIEWPORT = { once: true, amount: 0.3 } as const;

interface TierCard {
  key: "amateur" | "century" | "maximum";
  accent: string;
  title: string;
  subtitle?: string;
  badge?: string;
  body: string;
}

interface HowItem {
  title: string;
  body: string;
}

export default function MemberPublic() {
  const t = useTranslations("member");
  const p = useTranslations("memberPublic");
  const howItems = p.raw("how_items") as HowItem[];

  const cards: TierCard[] = [
    { key: "amateur", accent: "#22C55E", title: t("amateur_title"), body: t("amateur_body") },
    { key: "century", accent: "#F59E0B", title: t("century_title"), subtitle: t("century_subtitle"), body: t("century_body") },
    { key: "maximum", accent: "#A78BFA", title: t("maximum_title"), subtitle: t("maximum_subtitle"), badge: t("maximum_badge"), body: t("maximum_body") },
  ];

  return (
    <main className="relative bg-black" style={{ fontFamily: FONT_FAMILY }}>
      <Nav />

      {/* ── Hero ── */}
      <section data-nav-theme="dark" style={{ background: "#000", color: "white", padding: "clamp(140px, 20vw, 220px) 24px clamp(80px, 12vw, 140px)", textAlign: "center" }}>
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE }}
          style={{ fontSize: "clamp(48px, 9vw, 80px)", fontWeight: 700, letterSpacing: "-0.03em", margin: 0, lineHeight: 1 }}
          data-cms-key="memberPublic.hero_title"
        >
          <CMSText k="memberPublic.hero_title">{p("hero_title")}</CMSText>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.15 }}
          style={{ fontSize: "clamp(17px, 3vw, 20px)", color: "rgba(255,255,255,0.75)", margin: "20px 0 0" }}
          data-cms-key="memberPublic.hero_subtitle"
        >
          <CMSText k="memberPublic.hero_subtitle">{p("hero_subtitle")}</CMSText>
        </motion.p>

        <Link
          href="/login?returnUrl=/member"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            marginTop: "32px",
            background: GREEN,
            color: "#000",
            fontWeight: 700,
            fontSize: "16px",
            padding: "0 28px",
            height: "52px",
            borderRadius: "100px",
            textDecoration: "none",
          }}
          data-cms-key="memberPublic.cta_login"
        >
          <CMSText k="memberPublic.cta_login">{p("cta_login")}</CMSText>
        </Link>
      </section>

      {/* ── Tier cards — same copy/keys as the homepage membership section ── */}
      <section data-nav-theme="light" style={{ background: "#fff", color: DARK, padding: "clamp(80px, 12vw, 140px) 24px" }}>
        <div style={{ maxWidth: "1000px", margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "24px" }}>
          {cards.map((card, i) => (
            <motion.div
              key={card.key}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={VIEWPORT}
              transition={{ duration: 0.5, ease: EASE, delay: i * 0.08 }}
              style={{
                position: "relative",
                background: "#F5F5F7",
                border: "1px solid #E5E5E5",
                borderRadius: "24px",
                padding: "32px",
              }}
              data-cms-key={`member.${card.key}`}
            >
              {card.badge && (
                <span
                  style={{
                    position: "absolute",
                    top: "24px",
                    right: "24px",
                    fontSize: "11px",
                    color: card.accent,
                    background: `${card.accent}1F`,
                    border: `1px solid ${card.accent}59`,
                    borderRadius: "100px",
                    padding: "4px 10px",
                  }}
                >
                  {card.badge}
                </span>
              )}
              <h3 style={{ fontSize: "26px", fontWeight: 700, letterSpacing: "-0.02em", margin: "0 0 4px", color: DARK }}>
                {card.title}
              </h3>
              {card.subtitle && (
                <p style={{ fontSize: "15px", color: card.accent, fontWeight: 500, margin: "0 0 16px" }}>{card.subtitle}</p>
              )}
              <p style={{ fontSize: "15px", lineHeight: 1.6, color: "#494951", margin: card.subtitle ? 0 : "12px 0 0" }}>
                {card.body}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── 玩法介紹 — how membership works ── */}
      <section data-nav-theme="dark" style={{ background: "#1C1C1E", color: "white", padding: "clamp(80px, 12vw, 140px) 24px" }}>
        <div style={{ maxWidth: "760px", margin: "0 auto" }}>
          <motion.h2
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={VIEWPORT}
            transition={{ duration: 0.6, ease: EASE }}
            style={{ fontSize: "clamp(32px, 5vw, 48px)", fontWeight: 700, letterSpacing: "-0.02em", margin: "0 0 48px" }}
            data-cms-key="memberPublic.how_title"
          >
            <CMSText k="memberPublic.how_title">{p("how_title")}</CMSText>
          </motion.h2>

          <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
            {howItems.map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={VIEWPORT}
                transition={{ duration: 0.5, ease: EASE, delay: i * 0.08 }}
                style={{ display: "flex", gap: "20px" }}
                data-cms-key={`memberPublic.how.${i}`}
              >
                <span
                  aria-hidden="true"
                  style={{
                    flexShrink: 0,
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    background: "rgba(34,197,94,0.15)",
                    color: GREEN,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "15px",
                    fontWeight: 700,
                  }}
                >
                  {i + 1}
                </span>
                <div>
                  <h3 style={{ fontSize: "19px", fontWeight: 600, margin: "0 0 6px" }}>{item.title}</h3>
                  <p style={{ fontSize: "16px", lineHeight: 1.6, color: "rgba(255,255,255,0.7)", margin: 0 }}>{item.body}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
