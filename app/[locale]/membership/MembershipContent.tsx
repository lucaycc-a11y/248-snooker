"use client";

import { QRCodeSVG } from "qrcode.react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

const GREEN = "#22C55E";
const DARK = "#1D1D1F";
const BORDER = "#2D2D2D";

const FONT_FAMILY =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Noto Sans TC', 'Helvetica Neue', Helvetica, Arial, sans-serif";

const EASE = [0.2, 0.7, 0.3, 1] as const;
const VIEWPORT = { once: true, amount: 0.2 } as const;

/* ── Inline SVG Icons ──────────────────────────────────────────────────── */

function SparkleIcon({ color }: { color?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={color ?? "currentColor"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="100%" height="100%">
      <path d="M12 2l1.09 3.36L16.44 6.44l-2.36 1.09L13.18 12l-1.09-4.47L9.73 6.44l3.36-1.08z" />
      <path d="M18 14l.6 1.85L20.45 16.45l-1.85.6L18 18.9l-.6-1.85-1.85-.6 1.85-.6z" />
    </svg>
  );
}

function TrophyIcon({ color }: { color?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={color ?? "currentColor"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="100%" height="100%">
      <path d="M6 9V2h12v7" />
      <path d="M6 6h12v4a6 6 0 01-12 0V6z" />
      <path d="M10 14v2a2 2 0 004 0v-2" />
      <path d="M4 2h4v3H4z" />
      <path d="M16 2h4v3h-4z" />
    </svg>
  );
}

function DiamondIcon({ color }: { color?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={color ?? "currentColor"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="100%" height="100%">
      <path d="M2.7 10.5l8.3 10.5 8.3-10.5L12 2 2.7 10.5z" />
      <path d="M2.7 10.5h18.6" />
      <path d="M8 21.5l4-11 4 11" />
    </svg>
  );
}

function EarnIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="28" height="28">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
      <path d="M16 3l1.5 1.5" />
    </svg>
  );
}

function UpgradeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="28" height="28">
      <path d="M12 19V5" />
      <path d="M5 12l7-7 7 7" />
    </svg>
  );
}

function SpendIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="28" height="28">
      <path d="M4 10h16v8a2 2 0 01-2 2H6a2 2 0 01-2-2V10z" />
      <path d="M12 10V21" />
      <path d="M4 10V8a2 2 0 012-2h12a2 2 0 012 2v2" />
      <path d="M12 2S9.6 5 8 5a2 2 0 000 4.4" />
      <path d="M12 2s2.4 3 4 3a2 2 0 010 4.4" />
    </svg>
  );
}

function TrackIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="28" height="28">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function QrIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="28" height="28">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="5" y="5" width="3" height="3" />
      <rect x="16" y="5" width="3" height="3" />
      <rect x="5" y="16" width="3" height="3" />
      <path d="M14 14h3v3h-3z" />
      <path d="M20 14v3h-3" />
      <path d="M17 20h3v-3" />
    </svg>
  );
}

/* ── Main Component ────────────────────────────────────────────────────── */

export default function MembershipContent() {
  const t = useTranslations("membershipHub");

  return (
    <div style={{ fontFamily: FONT_FAMILY, background: "#000", minHeight: "100vh" }}>
      {/* All Sections Rendered as Single Page Scroll */}
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 24px" }}>
        <section id="membership-tiers">
          <TabMembership t={t} />
        </section>
        <section id="member-qr">
          <TabQR t={t} />
        </section>
        <section id="smart-concierge">
          <TabPilot t={t} />
        </section>
        <section id="how-to-play">
          <TabPlay t={t} />
        </section>
      </div>
    </div>
  );
}

/* ── Tab 1: Membership ─────────────────────────────────────────────────── */

function TabMembership({ t }: { t: ReturnType<typeof useTranslations> }) {
  const tiers = [
    {
      icon: <SparkleIcon color="#86EFAC" />,
      accent: "#86EFAC",
      title: t("tier_new.title"),
      body: t("tier_new.body"),
      desc: t("tier_new.desc"),
    },
    {
      icon: <TrophyIcon color="#E5E7EB" />,
      accent: "#E5E7EB",
      title: t("tier_platinum.title"),
      subtitle: t("tier_platinum.subtitle"),
      body: t("tier_platinum.body"),
      desc: t("tier_platinum.desc"),
    },
    {
      icon: <DiamondIcon color="#BFDBFE" />,
      accent: "#BFDBFE",
      title: t("tier_diamond.title"),
      subtitle: t("tier_diamond.subtitle"),
      badge: t("tier_diamond.badge"),
      body: t("tier_diamond.body"),
      desc: t("tier_diamond.desc"),
    },
  ];

  const howIcons = [<EarnIcon />, <UpgradeIcon />, <SpendIcon />, <TrackIcon />];
  const howItems = t.raw("how_items") as Array<{ icon: string; title: string; body: string }>;

  return (
    <section style={{ padding: "clamp(40px, 8vw, 80px) 0" }}>
      {/* Tier Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={VIEWPORT}
        transition={{ duration: 0.6, ease: EASE }}
        style={{ textAlign: "center", marginBottom: "48px" }}
      >
        <h2 style={{ fontSize: "clamp(28px, 4.5vw, 44px)", fontWeight: 700, letterSpacing: "-0.02em", color: "#fff", margin: "0 0 16px" }}>
          {t("tier_title")}
        </h2>
        <Link
          href="/register"
          className="group inline-flex items-center"
          style={{
            color: GREEN,
            fontSize: "19px",
            textDecoration: "none",
            gap: "4px",
            padding: "12px 32px",
            borderRadius: "999px",
            border: `1px solid ${GREEN}`,
            transition: "all 0.3s ease",
          }}
        >
          <span className="group-hover:underline">{t("tier_cta")}</span>
          <span aria-hidden="true">→</span>
        </Link>
      </motion.div>

      {/* Tier Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))",
          gap: "20px",
          marginBottom: "64px",
        }}
      >
        {tiers.map((tier, i) => (
          <motion.div
            key={tier.title}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={VIEWPORT}
            transition={{ duration: 0.5, delay: i * 0.1, ease: EASE }}
            style={{
              background: DARK,
              border: `1px solid ${BORDER}`,
              borderRadius: "20px",
              padding: "32px",
              position: "relative",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {tier.badge && (
              <span
                style={{
                  position: "absolute",
                  top: "20px",
                  right: "20px",
                  fontSize: "11px",
                  color: tier.accent,
                  background: `${tier.accent}1F`,
                  border: `1px solid ${tier.accent}59`,
                  borderRadius: "100px",
                  padding: "4px 10px",
                }}
              >
                {tier.badge}
              </span>
            )}
            <div style={{ width: "44px", height: "44px", color: tier.accent, marginBottom: "20px" }}>
              {tier.icon}
            </div>
            <h3 className="font-label" style={{ fontSize: "24px", fontWeight: 700, letterSpacing: "-0.02em", margin: "0 0 4px", color: "#fff" }}>
              {tier.title}
            </h3>
            {tier.subtitle && (
              <p style={{ fontSize: "14px", color: tier.accent, fontWeight: 500, margin: "0 0 12px" }}>
                {tier.subtitle}
              </p>
            )}
            <p style={{ fontSize: "15px", lineHeight: 1.6, color: "rgba(255,255,255,0.7)", margin: "0 0 16px" }}>
              {tier.body}
            </p>
            <p style={{ fontSize: "14px", lineHeight: 1.6, color: "rgba(255,255,255,0.5)", margin: 0 }}>
              {tier.desc}
            </p>
          </motion.div>
        ))}
      </div>

      {/* How to Earn & Use */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={VIEWPORT}
        transition={{ duration: 0.6, ease: EASE }}
        style={{ textAlign: "center", marginBottom: "32px" }}
      >
        <h3 style={{ fontSize: "clamp(22px, 3.5vw, 32px)", fontWeight: 700, color: "#fff", margin: 0 }}>
          {t("how_title")}
        </h3>
      </motion.div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
          gap: "16px",
        }}
      >
        {howItems.map((item, i) => (
          <motion.div
            key={item.title}
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={VIEWPORT}
            transition={{ duration: 0.5, delay: i * 0.08, ease: EASE }}
            style={{
              border: `1px solid ${BORDER}`,
              borderRadius: "18px",
              padding: "24px",
            }}
          >
            <div style={{ color: GREEN, marginBottom: "16px" }}>
              {howIcons[i]}
            </div>
            <h4 style={{ fontSize: "17px", fontWeight: 600, color: "#fff", margin: "0 0 8px" }}>
              {item.title}
            </h4>
            <p style={{ fontSize: "14px", lineHeight: 1.7, color: "rgba(255,255,255,0.6)", margin: 0 }}>
              {item.body}
            </p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

/* ── Tab 2: QR Code ────────────────────────────────────────────────────── */

function TabQR({ t }: { t: ReturnType<typeof useTranslations> }) {
  return (
    <section style={{ padding: "clamp(40px, 8vw, 80px) 0", textAlign: "center" }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE }}
      >
        <h2 style={{ fontSize: "clamp(28px, 4.5vw, 44px)", fontWeight: 700, letterSpacing: "-0.02em", color: "#fff", margin: "0 0 16px" }}>
          {t("qr_title")}
        </h2>
        <p style={{ fontSize: "17px", lineHeight: 1.7, color: "rgba(255,255,255,0.7)", maxWidth: "600px", margin: "0 auto 48px" }}>
          {t("qr_desc")}
        </p>
      </motion.div>

      {/* QR Illustration — static demo QR code */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.2, ease: EASE }}
        style={{
          width: "min(80vw, 280px)",
          height: "min(80vw, 280px)",
          margin: "0 auto 32px",
          background: DARK,
          border: `1px solid ${BORDER}`,
          borderRadius: "24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        <QRCodeSVG
          value="SPACE8-DEMO-A1B2C3"
          size={200}
          bgColor="transparent"
          fgColor="#22C55E"
          level="M"
        />
      </motion.div>

      <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)", margin: "0 0 32px" }}>
        {t("qr_placeholder")}
      </p>

      <Link
        href="/member"
        className="group inline-flex items-center"
        style={{
          color: GREEN,
          fontSize: "16px",
          textDecoration: "none",
          gap: "4px",
          padding: "14px 36px",
          borderRadius: "999px",
          border: `1px solid ${GREEN}`,
          transition: "all 0.3s ease",
        }}
      >
        <span className="group-hover:underline">{t("qr_cta")}</span>
        <span aria-hidden="true">→</span>
      </Link>
    </section>
  );
}

/* ── Tab 3: Smart Concierge ────────────────────────────────────────────── */

function TabPilot({ t }: { t: ReturnType<typeof useTranslations> }) {
  const features = t.raw("pilot_features") as Array<{ title: string; body: string }>;

  return (
    <section style={{ padding: "clamp(40px, 8vw, 80px) 0" }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={VIEWPORT}
        transition={{ duration: 0.6, ease: EASE }}
        style={{ textAlign: "center", marginBottom: "48px" }}
      >
        <h2 style={{ fontSize: "clamp(28px, 4.5vw, 44px)", fontWeight: 700, letterSpacing: "-0.02em", color: "#fff", margin: "0 0 12px" }}>
          {t("pilot_title")}
        </h2>
      </motion.div>

      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {features.map((feature, i) => (
          <motion.div
            key={feature.title}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={VIEWPORT}
            transition={{ duration: 0.5, delay: i * 0.04, ease: EASE }}
            style={{
              border: `1px solid ${BORDER}`,
              borderRadius: "18px",
              padding: "24px",
              display: "flex",
              gap: "20px",
              alignItems: "flex-start",
            }}
          >
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "12px",
                background: "rgba(34,197,94,0.1)",
                border: "1px solid rgba(34,197,94,0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                color: GREEN,
              }}
            >
              <span style={{ fontSize: "18px", fontWeight: 700 }}>{i + 1}</span>
            </div>
            <div>
              <h4 style={{ fontSize: "17px", fontWeight: 600, color: "#fff", margin: "0 0 6px" }}>
                {feature.title}
              </h4>
              <p style={{ fontSize: "14px", lineHeight: 1.7, color: "rgba(255,255,255,0.6)", margin: 0 }}>
                {feature.body}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

/* ── Tab 4: How to Play ────────────────────────────────────────────────── */

function TabPlay({ t }: { t: ReturnType<typeof useTranslations> }) {
  const playIcons = [<QrIcon />, <TrophyIcon color={GREEN} />, <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="28" height="28"><circle cx="12" cy="12" r="3" /><path d="M12 2v4" /><path d="M12 18v4" /><path d="M4.93 4.93l2.83 2.83" /><path d="M16.24 16.24l2.83 2.83" /><path d="M2 12h4" /><path d="M18 12h4" /></svg>, <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="28" height="28"><path d="M12 19V5" /><path d="M5 12l7-7 7 7" /></svg>];
  const playItems = t.raw("play_items") as Array<{ title: string; body: string }>;

  return (
    <section style={{ padding: "clamp(40px, 8vw, 80px) 0" }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={VIEWPORT}
        transition={{ duration: 0.6, ease: EASE }}
        style={{ textAlign: "center", marginBottom: "48px" }}
      >
        <h2 style={{ fontSize: "clamp(28px, 4.5vw, 44px)", fontWeight: 700, letterSpacing: "-0.02em", color: "#fff", margin: "0 0 12px" }}>
          {t("play_title")}
        </h2>
      </motion.div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
          gap: "16px",
        }}
      >
        {playItems.map((item, i) => (
          <motion.div
            key={item.title}
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={VIEWPORT}
            transition={{ duration: 0.5, delay: i * 0.08, ease: EASE }}
            style={{
              border: `1px solid ${BORDER}`,
              borderRadius: "18px",
              padding: "24px",
            }}
          >
            <div style={{ color: GREEN, marginBottom: "16px" }}>
              {playIcons[i]}
            </div>
            <h4 style={{ fontSize: "17px", fontWeight: 600, color: "#fff", margin: "0 0 8px" }}>
              {item.title}
            </h4>
            <p style={{ fontSize: "14px", lineHeight: 1.7, color: "rgba(255,255,255,0.6)", margin: 0 }}>
              {item.body}
            </p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
