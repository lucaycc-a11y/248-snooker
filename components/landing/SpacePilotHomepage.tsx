"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

const GREEN = "#22C55E";
const BORDER = "#2D2D2D";

const FONT_FAMILY =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Noto Sans TC', 'Helvetica Neue', Helvetica, Arial, sans-serif";

const EASE = [0.2, 0.7, 0.3, 1] as const;

/* ── Inline SVG Icons ──────────────────────────────────────────────────── */

function FlowCardIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="28" height="28">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="5" y="5" width="3" height="3" />
      <rect x="16" y="5" width="3" height="3" />
      <rect x="5" y="16" width="3" height="3" />
    </svg>
  );
}

function ScoreCardIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="28" height="28">
      <rect x="3" y="3" width="18" height="14" rx="2" />
      <path d="M8 21h8" />
      <path d="M12 17v4" />
      <path d="M7 8l3 3 3-3" />
    </svg>
  );
}

function RecordCardIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="28" height="28">
      <path d="M12 2l1.09 3.36L16.44 6.44l-2.36 1.09L13.18 12l-1.09-4.47L9.73 6.44l3.36-1.08z" />
      <path d="M18 14l.6 1.85L20.45 16.45l-1.85.6L18 18.9l-.6-1.85-1.85-.6 1.85-.6z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function StarIcon({ color = "#86EFAC" }: { color?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
      <path d="M12 2l1.09 3.36L16.44 6.44l-2.36 1.09L13.18 12l-1.09-4.47L9.73 6.44l3.36-1.08z" />
    </svg>
  );
}

function TrophySmallIcon({ color = "#E5E7EB" }: { color?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
      <path d="M6 9V2h12v7" />
      <path d="M6 6h12v4a6 6 0 01-12 0V6z" />
    </svg>
  );
}

/* ── Main Component ────────────────────────────────────────────────────── */

type SpacePilotHomepageProps = {
  compact?: boolean;
};

export default function SpacePilotHomepage({ compact = false }: SpacePilotHomepageProps) {
  const t = useTranslations("spacePilot");
  const hubT = useTranslations("membershipHub");

  return (
    <section
      data-nav-theme="dark"
      style={{
        background: "#000",
        color: "#fff",
        padding: compact ? "88px 20px" : "clamp(88px, 12vw, 140px) 20px",
        fontFamily: FONT_FAMILY,
      }}
    >
      <div style={{ maxWidth: 1120, margin: "0 auto" }}>
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.7, ease: EASE }}
          style={{ maxWidth: 700, marginBottom: compact ? 34 : 52 }}
        >
          <p
            data-cms-key="spacePilot.eyebrow"
            className="font-label"
            style={{ color: GREEN, fontSize: 12, margin: "0 0 14px" }}
          >
            {t("eyebrow")}
          </p>
          <h2 id="space-pilot-title" data-cms-key="spacePilot.title" style={{ fontSize: "clamp(2rem, 5vw, 4rem)", lineHeight: 1.08, letterSpacing: "-0.04em", margin: 0 }}>
            {t("title")}
          </h2>
          <p data-cms-key="spacePilot.intro" style={{ color: "rgba(255,255,255,0.62)", fontSize: "clamp(15px, 2vw, 18px)", lineHeight: 1.7, margin: "20px 0 0", maxWidth: "58ch" }}>
            {t("intro")}
          </p>
        </motion.div>

        {/* Cards Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
            gap: "20px",
            marginBottom: compact ? 0 : "48px",
          }}
        >
          {/* Card 1 — Flow Card */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.15 }}
            transition={{ duration: 0.65, delay: 0, ease: EASE }}
            style={{
              border: `1px solid ${BORDER}`,
              borderRadius: "20px",
              padding: "28px 24px",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={{ color: GREEN, marginBottom: "20px" }}>
              <FlowCardIcon />
            </div>
            <h3 style={{ fontSize: "20px", fontWeight: 700, letterSpacing: "-0.01em", margin: "0 0 20px", color: "#fff" }}>
              {t("title")}
            </h3>

            {/* QR Illustration (decorative) */}
            <div
              style={{
                width: "100%",
                maxWidth: "180px",
                aspectRatio: "1",
                margin: "0 auto 20px",
                background: "rgba(255,255,255,0.04)",
                border: `1px solid ${BORDER}`,
                borderRadius: "16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "rgba(255,255,255,0.15)",
              }}
            >
              <svg viewBox="0 0 200 200" width="70%" height="70%">
                <rect x="20" y="20" width="50" height="50" rx="4" stroke="currentColor" strokeWidth="3" fill="none" />
                <rect x="130" y="20" width="50" height="50" rx="4" stroke="currentColor" strokeWidth="3" fill="none" />
                <rect x="20" y="130" width="50" height="50" rx="4" stroke="currentColor" strokeWidth="3" fill="none" />
                <rect x="30" y="30" width="30" height="30" rx="2" fill="currentColor" />
                <rect x="140" y="30" width="30" height="30" rx="2" fill="currentColor" />
                <rect x="30" y="140" width="30" height="30" rx="2" fill="currentColor" />
                <rect x="85" y="85" width="30" height="30" rx="2" fill="currentColor" />
              </svg>
            </div>

            {/* 3-Step Flow */}
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "20px" }}>
              {["01", "02", "03"].map((num, i) => {
                const labels = [
                  ["掃碼報到", "Scan to check in"],
                  ["建立比賽", "Create a match"],
                  ["開始計分", "Start scoring"],
                ];
                return (
                  <div
                    key={num}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                    }}
                  >
                    <span
                      style={{
                        width: "28px",
                        height: "28px",
                        borderRadius: "8px",
                        background: "rgba(34,197,94,0.1)",
                        border: "1px solid rgba(34,197,94,0.2)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "12px",
                        fontWeight: 700,
                        color: GREEN,
                        flexShrink: 0,
                      }}
                    >
                      {num}
                    </span>
                    <span style={{ fontSize: "15px", color: "rgba(255,255,255,0.8)" }}>
                      {labels[i][0]}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Tags */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "auto" }}>
              {["純自助・無需櫃枱", "繁中／簡中／EN", "Space Infinity & Eternity"].map((tag) => (
                <span
                  key={tag}
                  style={{
                    fontSize: "12px",
                    color: "rgba(255,255,255,0.5)",
                    border: `1px solid ${BORDER}`,
                    borderRadius: "100px",
                    padding: "4px 12px",
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </motion.div>

          {/* Card 2 — Live Score Demo */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.15 }}
            transition={{ duration: 0.65, delay: 0.08, ease: EASE }}
            style={{
              border: `1px solid ${BORDER}`,
              borderRadius: "20px",
              padding: "28px 24px",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={{ color: GREEN, marginBottom: "20px" }}>
              <ScoreCardIcon />
            </div>
            <h3 style={{ fontSize: "20px", fontWeight: 700, letterSpacing: "-0.01em", margin: "0 0 8px", color: "#fff" }}>
              大螢幕即時比分
            </h3>
            <p style={{ fontSize: "14px", lineHeight: 1.7, color: "rgba(255,255,255,0.6)", margin: "0 0 24px" }}>
              紅隊對藍隊，清晰醒目，從球室任何角落都能看見。
            </p>

            {/* Score Demo UI */}
            <div
              style={{
                background: "rgba(255,255,255,0.04)",
                border: `1px solid ${BORDER}`,
                borderRadius: "16px",
                padding: "24px",
                marginTop: "auto",
              }}
            >
              {/* Score Bar */}
              <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "16px" }}>
                <div style={{ flex: 1, textAlign: "center" }}>
                  <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.5)", margin: "0 0 4px" }}>紅隊</p>
                  <p style={{ fontSize: "36px", fontWeight: 800, color: "#EF4444", margin: 0, letterSpacing: "-0.02em" }}>8</p>
                </div>
                <div style={{ width: "1px", height: "40px", background: BORDER }} />
                <div style={{ flex: 1, textAlign: "center" }}>
                  <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.5)", margin: "0 0 4px" }}>藍隊</p>
                  <p style={{ fontSize: "36px", fontWeight: 800, color: "#3B82F6", margin: 0, letterSpacing: "-0.02em" }}>6</p>
                </div>
              </div>
              {/* Progress Bar */}
              <div style={{ display: "flex", height: "6px", borderRadius: "3px", overflow: "hidden", background: "rgba(255,255,255,0.06)" }}>
                <div style={{ width: `${(8 / (8 + 6)) * 100}%`, background: "#EF4444", borderRadius: "3px 0 0 3px" }} />
                <div style={{ width: `${(6 / (8 + 6)) * 100}%`, background: "#3B82F6", borderRadius: "0 3px 3px 0" }} />
              </div>
              <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)", margin: "10px 0 0", textAlign: "center" }}>
                Frame 7 · 8-Ball · Space Infinity
              </p>
            </div>
          </motion.div>

          {/* Card 3 — Record Demo */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.15 }}
            transition={{ duration: 0.65, delay: 0.16, ease: EASE }}
            style={{
              border: `1px solid ${BORDER}`,
              borderRadius: "20px",
              padding: "28px 24px",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={{ color: GREEN, marginBottom: "20px" }}>
              <RecordCardIcon />
            </div>
            <h3 style={{ fontSize: "20px", fontWeight: 700, letterSpacing: "-0.01em", margin: "0 0 8px", color: "#fff" }}>
              戰績自動累積
            </h3>
            <p style={{ fontSize: "14px", lineHeight: 1.7, color: "rgba(255,255,255,0.6)", margin: "0 0 24px" }}>
              每一場比賽結果都會記錄到你的個人戰績，從新星到鉑金到鑽石，每一局都算數。
            </p>

            {/* Record Demo UI */}
            <div
              style={{
                background: "rgba(255,255,255,0.04)",
                border: `1px solid ${BORDER}`,
                borderRadius: "16px",
                padding: "20px",
                marginTop: "auto",
              }}
            >
              {/* Member Info */}
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "50%",
                    background: "rgba(34,197,94,0.15)",
                    border: "1px solid rgba(34,197,94,0.3)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: GREEN,
                  }}
                >
                  <span style={{ fontSize: "16px", fontWeight: 700 }}>王</span>
                </div>
                <div>
                  <p style={{ fontSize: "15px", fontWeight: 600, color: "#fff", margin: "0 0 2px" }}>王大明</p>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <TrophySmallIcon />
                    <span style={{ fontSize: "12px", color: "#E5E7EB" }}>鉑金會員</span>
                  </div>
                </div>
              </div>

              {/* Total Wins */}
              <div style={{ display: "flex", alignItems: "baseline", gap: "4px", marginBottom: "12px" }}>
                <span style={{ fontSize: "32px", fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>49</span>
                <span style={{ fontSize: "14px", color: "rgba(255,255,255,0.5)" }}>總勝場</span>
              </div>

              {/* Progress Bar */}
              <div style={{ marginBottom: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                  <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)" }}>鉑金</span>
                  <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)" }}>鑽石</span>
                </div>
                <div style={{ height: "6px", borderRadius: "3px", background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                  <div style={{ width: "61%", height: "100%", background: "linear-gradient(90deg, #E5E7EB, #BFDBFE)", borderRadius: "3px" }} />
                </div>
              </div>

              {/* Recent Matches */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {[
                  { result: "win", score: "8 vs 5", date: "今天" },
                  { result: "win", score: "8 vs 6", date: "昨天" },
                  { result: "loss", score: "4 vs 8", date: "3 天前" },
                ].map((match, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "6px 10px",
                      borderRadius: "8px",
                      background: match.result === "win" ? "rgba(34,197,94,0.08)" : "rgba(255,255,255,0.03)",
                    }}
                  >
                    <span
                      className="font-label"
                      style={{
                        fontSize: "11px",
                        fontWeight: 600,
                        color: match.result === "win" ? "#22C55E" : "rgba(255,255,255,0.5)",
                      }}
                    >
                      {match.result === "win" ? "WIN" : "LOSS"}
                    </span>
                    <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.7)" }}>{match.score}</span>
                    <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)" }}>{match.date}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>

        {/* Bottom CTAs */}
        {!compact && (
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.6, ease: EASE }}
            style={{ display: "flex", flexWrap: "wrap", gap: "12px", justifyContent: "center" }}
          >
            <Link
              href="/book"
              className="group inline-flex items-center"
              data-cms-key="spacePilot.cta_book"
              style={{
                background: GREEN,
                color: "#000",
                fontSize: "15px",
                fontWeight: 600,
                padding: "14px 32px",
                borderRadius: "999px",
                textDecoration: "none",
                transition: "all 0.3s ease",
              }}
            >
              <span className="group-hover:opacity-90">{t("cta_book")}</span>
            </Link>
            <Link
              href="/membership?tab=qr"
              className="group inline-flex items-center"
              data-cms-key="spacePilot.cta_qr"
              style={{
                color: GREEN,
                fontSize: "15px",
                fontWeight: 500,
                padding: "14px 32px",
                borderRadius: "999px",
                border: `1px solid ${GREEN}`,
                textDecoration: "none",
                transition: "all 0.3s ease",
              }}
            >
              <span className="group-hover:underline">{t("cta_qr")}</span>
            </Link>
          </motion.div>
        )}
      </div>
    </section>
  );
}
