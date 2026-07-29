"use client";

import { useEffect, useRef, useCallback } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  Target,
  Lightbulb,
  Thermometer,
  Wifi,
  CupSoda,
  QrCode,
  BadgeCheck,
  MousePointerClick,
  CalendarCheck,
  MessageCircle,
  MapPin,
  CloudRain,
  ChevronRight,
  Star,
  Sun,
  Moon,
} from "lucide-react";

const DARK = "#1D1D1F";
const SUBTLE = "#6e6e73";
const GREEN = "#22C55E";
const GOLD = "#1a9d5c";
const GOLD_BRIGHT = "#22b86b";
const BG = "#111110";

const FONT_FAMILY =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Helvetica, Arial, sans-serif";

const EASE = [0.16, 1, 0.3, 1] as const;
const POP = [0.34, 1.56, 0.64, 1] as const;
const VIEWPORT = { once: true, amount: 0.25 } as const;

const ADDRESS = "香港新蒲崗大有街 32 號泰力工業中心 3 樓 05 室";
const MAPS_URL = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
  "泰力工業中心 32 Tai Yau Street, San Po Kong, Hong Kong",
)}`;

const FACILITY_ICONS = [Target, Lightbulb, Thermometer, Wifi, CupSoda, QrCode];
const SERVICE_ICONS = [BadgeCheck, MousePointerClick, CalendarCheck, MessageCircle];

type TitledItem = { title: string; body: string };

const sectionTitleStyle: React.CSSProperties = {
  fontSize: "clamp(1.7rem, 3.4vw, 2.4rem)",
  fontWeight: 900,
  letterSpacing: "0.005em",
  margin: "0 0 48px",
};

/* ── CSS for the comparison pop-in section ── */
const COMPARE_CSS = `
.room-compare-section {
  background: #1d1d1f;
  padding: clamp(80px, 10vw, 130px) 24px;
}
.room-compare-inner {
  max-width: 1100px;
  margin: 0 auto;
}
.room-compare-title {
  font-family: 'Noto Sans TC', 'SF Pro Display', sans-serif;
  font-weight: 900;
  font-size: clamp(1.7rem, 3.4vw, 2.4rem);
  color: #f5f2ec;
  margin-bottom: 12px;
}
.room-compare-sub {
  font-size: 14.5px;
  color: rgba(245, 242, 236, 0.5);
  margin-bottom: 48px;
}
.room-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}
.room-card {
  position: relative;
  border-radius: 20px;
  overflow: hidden;
  background: #0d0d0f;
  border: 1px solid rgba(255, 255, 255, 0.08);
  opacity: 0;
  transform: translateY(24px) scale(0.95);
  transition: opacity 0.7s cubic-bezier(.34,1.56,.64,1),
              transform 0.7s cubic-bezier(.34,1.56,.64,1),
              box-shadow 0.6s ease;
  will-change: transform, opacity;
}
.room-card.is-in {
  opacity: 1;
  transform: none;
}
.room-card:nth-child(1) {
  transition-delay: 0s;
}
.room-card:nth-child(2) {
  transition-delay: 0.18s;
}
/* Shadow-pulse on landing */
.room-card.is-in {
  box-shadow: 0 0 0 0 rgba(34, 184, 107, 0);
  animation: roomShadowPulse 0.9s ease-out;
}
.room-card:nth-child(2).is-in {
  animation-delay: 0.18s;
}
@keyframes roomShadowPulse {
  0% {
    box-shadow: 0 0 0 0 rgba(34, 184, 107, 0.3);
  }
  30% {
    box-shadow: 0 0 30px 6px rgba(34, 184, 107, 0.15);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(34, 184, 107, 0);
  }
}
.room-card-image {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 11;
  overflow: hidden;
  opacity: 0;
  transform: translateY(12px) scale(0.97);
  transition: opacity 0.6s cubic-bezier(.34,1.56,.64,1),
              transform 0.6s cubic-bezier(.34,1.56,.64,1);
}
.room-card.is-in .room-card-image {
  opacity: 1;
  transform: none;
  transition-delay: 0.08s;
}
.room-card-body {
  padding: 28px 28px 34px;
}
.room-card-name {
  font-family: 'Inter', sans-serif;
  font-weight: 700;
  font-size: clamp(20px, 2.5vw, 26px);
  color: #f5f2ec;
  margin: 0 0 4px;
  opacity: 0;
  transform: translateY(8px);
  transition: opacity 0.5s cubic-bezier(.34,1.56,.64,1),
              transform 0.5s cubic-bezier(.34,1.56,.64,1);
}
.room-card.is-in .room-card-name {
  opacity: 1;
  transform: none;
  transition-delay: 0.2s;
}
.room-card-name-sub {
  font-family: 'Noto Sans TC', sans-serif;
  font-size: 14px;
  color: rgba(245, 242, 236, 0.5);
  margin: 0 0 18px;
  opacity: 0;
  transform: translateY(8px);
  transition: opacity 0.5s cubic-bezier(.34,1.56,.64,1),
              transform 0.5s cubic-bezier(.34,1.56,.64,1);
}
.room-card.is-in .room-card-name-sub {
  opacity: 1;
  transform: none;
  transition-delay: 0.28s;
}
.room-card-specs {
  list-style: none;
  margin: 0;
  padding: 0;
}
.room-card-specs li {
  position: relative;
  padding-left: 20px;
  font-family: 'Inter', 'Noto Sans TC', sans-serif;
  font-size: 14px;
  line-height: 1.8;
  color: rgba(245, 242, 236, 0.62);
  opacity: 0;
  transform: translateY(6px);
  transition: opacity 0.45s cubic-bezier(.34,1.56,.64,1),
              transform 0.45s cubic-bezier(.34,1.56,.64,1);
}
.room-card-specs li::before {
  content: "";
  position: absolute;
  left: 2px;
  top: 0.72em;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #22b86b;
}
.room-card.is-in .room-card-specs li:nth-child(1) { opacity: 1; transform: none; transition-delay: 0.36s; }
.room-card.is-in .room-card-specs li:nth-child(2) { opacity: 1; transform: none; transition-delay: 0.44s; }
.room-card.is-in .room-card-specs li:nth-child(3) { opacity: 1; transform: none; transition-delay: 0.52s; }
.room-card.is-in .room-card-specs li:nth-child(4) { opacity: 1; transform: none; transition-delay: 0.60s; }
.room-card.is-in .room-card-specs li:nth-child(5) { opacity: 1; transform: none; transition-delay: 0.68s; }

/* ── Mobile: stack cards, tighten delays ── */
@media (max-width: 720px) {
  .room-grid {
    grid-template-columns: 1fr;
    gap: 18px;
  }
  .room-card:nth-child(2) {
    transition-delay: 0.12s;
  }
  .room-card:nth-child(2).is-in {
    animation-delay: 0.12s;
  }
  .room-card.is-in .room-card-image {
    transition-delay: 0.04s;
  }
  .room-card.is-in .room-card-name {
    transition-delay: 0.12s;
  }
  .room-card.is-in .room-card-name-sub {
    transition-delay: 0.18s;
  }
  .room-card.is-in .room-card-specs li:nth-child(1) { transition-delay: 0.24s; }
  .room-card.is-in .room-card-specs li:nth-child(2) { transition-delay: 0.30s; }
  .room-card.is-in .room-card-specs li:nth-child(3) { transition-delay: 0.36s; }
  .room-card.is-in .room-card-specs li:nth-child(4) { transition-delay: 0.42s; }
  .room-card.is-in .room-card-specs li:nth-child(5) { transition-delay: 0.48s; }
  .room-card-body {
    padding: 22px 22px 28px;
  }
}
@media (max-width: 560px) {
  .venue-dir-cta-button { width: 100% !important; min-height: 48px !important; justify-content: center !important; }
}

/* ── Reduced motion: show everything instantly ── */
@media (prefers-reduced-motion: reduce) {
  .room-card,
  .room-card-image,
  .room-card-name,
  .room-card-name-sub,
  .room-card-specs li {
    opacity: 1 !important;
    transform: none !important;
    transition: none !important;
    animation: none !important;
  }
  .room-card:nth-child(1),
  .room-card:nth-child(2) {
    transition-delay: 0s !important;
  }
}
`;

export default function VenueContent() {
  const t = useTranslations("venuePage");
  const facilities = t.raw("facilities") as TitledItem[];
  const services = t.raw("services") as TitledItem[];
  const rules = t.raw("rules") as string[];

  /* ── IntersectionObserver for room comparison section ── */
  const compareRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = compareRef.current;
    if (!el) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion || !("IntersectionObserver" in window)) {
      el.querySelectorAll(".room-card").forEach((c) => c.classList.add("is-in"));
      return;
    }

    const cards = Array.from(el.querySelectorAll(".room-card"));
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-in");
          obs.unobserve(entry.target);
        });
      },
      { threshold: 0.2, rootMargin: "0px 0px -6% 0px" },
    );
    cards.forEach((card) => obs.observe(card));
    return () => obs.disconnect();
  }, []);

  /* ── Parallax for hero 8-ball ── */
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const ballProgress = useTransform(scrollYProgress, [0, 1], [0, 1]);

  const sectionTitle = useCallback(
    (text: string): React.CSSProperties => ({
      ...sectionTitleStyle,
      color: text === "場地設施" || text === "如何前往" ? "#111110" : "#f5f2ec",
    }),
    [],
  );

  return (
    <div style={{ fontFamily: FONT_FAMILY }}>
      <style>{COMPARE_CSS}</style>

      {/* ── Hero — 8-ball parallax ── */}
      <section
        ref={heroRef}
        data-nav-theme="dark"
        style={{
          position: "relative",
          height: "85vh",
          minHeight: "460px",
          overflow: "hidden",
          background: "#ffffff",
        }}
      >
        <div
          style={{
            position: "sticky",
            top: 0,
            height: "55vh",
            minHeight: "460px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            overflow: "hidden",
            padding: "0 24px",
          }}
        >
          {/* Lamp glow */}
          <div
            style={{
              position: "absolute",
              top: "-15%",
              left: "50%",
              transform: "translateX(-50%)",
              width: "900px",
              height: "900px",
              background:
                "radial-gradient(circle, rgba(20,102,80,0.07) 0%, rgba(20,102,80,0.03) 38%, transparent 68%)",
              pointerEvents: "none",
              zIndex: 0,
            }}
          />

          {/* Rings */}
          <div
            style={{
              position: "absolute",
              width: "640px",
              height: "640px",
              borderRadius: "50%",
              border: "1px solid rgba(17,17,16,0.06)",
              top: "50%",
              left: "50%",
              transform: "translate(-50%,-50%)",
              zIndex: 0,
            }}
          />
          <div
            style={{
              position: "absolute",
              width: "920px",
              height: "920px",
              borderRadius: "50%",
              border: "1px solid rgba(17,17,16,0.06)",
              top: "50%",
              left: "50%",
              transform: "translate(-50%,-50%)",
              zIndex: 0,
            }}
          />

          {/* Eyebrow */}
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE }}
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "12px",
              letterSpacing: "0.18em",
              color: "rgba(17,17,16,0.58)",
              textTransform: "uppercase",
              marginBottom: "18px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              position: "relative",
              zIndex: 2,
            }}
          >
            <span
              style={{
                width: "5px",
                height: "5px",
                borderRadius: "50%",
                background: "#146650",
                display: "inline-block",
              }}
            />
            自助入場 · 無菸環境
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.1 }}
            style={{
              fontFamily: "'Noto Sans TC', sans-serif",
              fontWeight: 900,
              fontSize: "clamp(2.1rem, 5.2vw, 4.4rem)",
              lineHeight: 1.28,
              letterSpacing: "0.005em",
              maxWidth: "16ch",
              color: "#111110",
              position: "relative",
              zIndex: 2,
              margin: 0,
            }}
          >
            自助中式桌球<br />
            獨立球室
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.2 }}
            style={{
              marginTop: "18px",
              fontSize: "clamp(15px, 1.6vw, 18px)",
              color: "rgba(17,17,16,0.58)",
              maxWidth: "480px",
              lineHeight: 1.7,
              position: "relative",
              zIndex: 2,
            }}
          >
            獨立球室，無多餘干擾。一顆球、一支桿、一段不被打斷的時間，掃碼開門，燈光為你亮起。
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE, delay: 0.35 }}
            style={{
              marginTop: "30px",
              display: "flex",
              gap: "16px",
              flexWrap: "wrap",
              justifyContent: "center",
              position: "relative",
              zIndex: 2,
            }}
          >
            <Link
              href="/book"
              style={{
                fontSize: "14.5px",
                fontWeight: 500,
                padding: "15px 34px",
                borderRadius: "999px",
                textDecoration: "none",
                display: "inline-block",
                background: `linear-gradient(180deg, ${GOLD_BRIGHT}, ${GOLD})`,
                color: "#ffffff",
                boxShadow: "0 8px 30px -8px rgba(26,157,92,0.4)",
              }}
            >
              立即預約
            </Link>
          </motion.div>

          {/* 8-ball with parallax */}
          <motion.div
            id="eightball"
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              width: "min(24vw, 280px)",
              height: "min(24vw, 280px)",
              zIndex: 5,
              filter: "drop-shadow(0 40px 60px rgba(0,0,0,0.28))",
              x: useTransform(ballProgress, [0, 1], ["-50%", "calc(-50% + 135vw)"]),
              y: useTransform(ballProgress, [0, 1], ["-50%", "calc(-50% + 0px)"]),
              rotate: useTransform(ballProgress, [0, 1], [0, 500]),
              scale: useTransform(ballProgress, [0, 1], [1, 0.75]),
            }}
          >
            <Image
              src="/gallery/IMG_1511.jpg"
              alt="8-ball"
              fill
              sizes="min(24vw, 280px)"
              style={{ objectFit: "cover", borderRadius: "50%" }}
              priority
            />
          </motion.div>
        </div>
      </section>

      {/* ── Facilities — dark ── */}
      <section
        data-nav-theme="dark"
        style={{
          background: "#000000",
          color: "#f5f2ec",
          padding: "clamp(80px, 10vw, 130px) 24px",
        }}
      >
        <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={VIEWPORT}
            transition={{ duration: 0.6, ease: EASE }}
            style={{
              fontFamily: "'Noto Sans TC', sans-serif",
              fontWeight: 900,
              fontSize: "clamp(1.7rem, 3.4vw, 2.4rem)",
              color: "#f5f2ec",
              margin: "0 0 48px",
            }}
          >
            {t("facilities_title")}
          </motion.h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "20px",
            }}
          >
            {facilities.map((item, i) => {
              const Icon = FACILITY_ICONS[i] ?? Target;
              return (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 24, scale: 0.95 }}
                  whileInView={{ opacity: 1, y: 0, scale: 1 }}
                  viewport={VIEWPORT}
                  transition={{ duration: 0.5, ease: POP, delay: i * 0.06 }}
                  style={{
                    position: "relative",
                    borderRadius: "16px",
                    background: "#0d0d0f",
                    border: "1px solid rgba(255,255,255,0.08)",
                    padding: "32px 28px 30px",
                    overflow: "hidden",
                  }}
                >
                  <Icon
                    size={26}
                    color={GOLD_BRIGHT}
                    strokeWidth={1.6}
                    style={{ marginBottom: 22 }}
                  />
                  <h3
                    style={{
                      fontFamily: "'Noto Sans TC', sans-serif",
                      fontWeight: 700,
                      fontSize: "16.5px",
                      color: "#f5f2ec",
                      margin: "0 0 10px",
                    }}
                  >
                    {item.title}
                  </h3>
                  <p
                    style={{
                      fontSize: "13.5px",
                      lineHeight: 1.7,
                      color: "rgba(245,242,236,0.5)",
                      margin: 0,
                    }}
                  >
                    {item.body}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Comparison section: 兩間 1T 獨立球室 ── */}
      <section
        ref={compareRef}
        className="room-compare-section"
        data-nav-theme="dark"
      >
        <div className="room-compare-inner">
          <motion.h2
            className="room-compare-title"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={VIEWPORT}
            transition={{ duration: 0.6, ease: EASE }}
          >
            兩間 1T 獨立球室
          </motion.h2>
          <motion.p
            className="room-compare-sub"
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={VIEWPORT}
            transition={{ duration: 0.5, ease: EASE, delay: 0.08 }}
          >
            兩間獨立球室，規格一致，配置相同 —— 無論選擇哪一間，體驗同樣出色。
          </motion.p>

          <div className="room-grid">
            {/* ── Room 1: Space Infinity ── */}
            <div className="room-card">
              <div className="room-card-image">
                <Image
                  src="/gallery/IMG_1511.jpg"
                  alt="Space Infinity（無限空間球室）"
                  fill
                  sizes="(max-width: 720px) 100vw, 50vw"
                  style={{ objectFit: "cover" }}
                />
              </div>
              <div className="room-card-body">
                <h3 className="room-card-name">Space Infinity</h3>
                <p className="room-card-name-sub">無限空間球室</p>
                <ul className="room-card-specs">
                  <li>星牌中式桌球枱 × 1</li>
                  <li>專業級比賽照明</li>
                  <li>恆溫冷氣系統</li>
                  <li>智能 QR 門禁 · 自助進場</li>
                  <li>可容納最多 8 人</li>
                </ul>
              </div>
            </div>

            {/* ── Room 2: Space Eternity ── */}
            <div className="room-card">
              <div className="room-card-image">
                <Image
                  src="/gallery/IMG_1512.jpg"
                  alt="Space Eternity（永恆空間球室）"
                  fill
                  sizes="(max-width: 720px) 100vw, 50vw"
                  style={{ objectFit: "cover" }}
                />
              </div>
              <div className="room-card-body">
                <h3 className="room-card-name">Space Eternity</h3>
                <p className="room-card-name-sub">永恆空間球室</p>
                <ul className="room-card-specs">
                  <li>星牌中式桌球枱 × 1</li>
                  <li>專業級比賽照明</li>
                  <li>恆溫冷氣系統</li>
                  <li>智能 QR 門禁 · 自助進場</li>
                  <li>可容納最多 8 人</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Service section — white ── */}
      <section
        data-nav-theme="light"
        style={{
          background: "#ffffff",
          padding: "clamp(90px, 10vw, 140px) 24px",
        }}
      >
        <div style={{ maxWidth: "1160px", margin: "0 auto" }}>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={VIEWPORT}
            transition={{ duration: 0.6, ease: EASE }}
            style={{
              fontFamily: "'Noto Sans TC', sans-serif",
              fontWeight: 900,
              fontSize: "clamp(1.7rem, 3.4vw, 2.4rem)",
              color: "#111110",
              margin: "0 0 56px",
            }}
          >
            {t("services_title")}
          </motion.h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "22px",
            }}
          >
            {services.map((item, i) => {
              const Icon = SERVICE_ICONS[i] ?? BadgeCheck;
              return (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 24, scale: 0.95 }}
                  whileInView={{ opacity: 1, y: 0, scale: 1 }}
                  viewport={VIEWPORT}
                  transition={{
                    duration: 0.6,
                    ease: [0.28, 1.5, 0.52, 1],
                    delay: i * 0.08,
                  }}
                  style={{
                    position: "relative",
                    background: "#ffffff",
                    border: "1px solid rgba(17,17,16,0.10)",
                    borderRadius: "18px",
                    padding: "30px 26px 28px",
                    boxShadow: "0 1px 2px rgba(17,17,16,0.04)",
                  }}
                >
                  <div
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: "11px",
                      letterSpacing: "0.14em",
                      color: "rgba(17,17,16,0.35)",
                      marginBottom: "20px",
                    }}
                  >
                    {i === 0
                      ? "STEP 01"
                      : i === 1
                        ? "STEP 02"
                        : i === 2
                          ? "STEP 03"
                          : "如有需要"}
                  </div>
                  <Icon
                    size={26}
                    color={GOLD}
                    strokeWidth={1.6}
                    style={{ marginBottom: 18 }}
                  />
                  <h3
                    style={{
                      fontFamily: "'Noto Sans TC', sans-serif",
                      fontWeight: 700,
                      fontSize: "16.5px",
                      color: "#111110",
                      margin: "0 0 10px",
                    }}
                  >
                    {item.title}
                  </h3>
                  <p
                    style={{
                      fontSize: "13.5px",
                      lineHeight: 1.75,
                      color: "rgba(17,17,16,0.58)",
                      margin: 0,
                    }}
                  >
                    {item.body}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Pricing — light gray ── */}
      <section
        data-nav-theme="light"
        style={{
          background: "#e8e8e8",
          padding: "clamp(86px, 10vw, 130px) 24px",
        }}
      >
        <div style={{ maxWidth: "1120px", margin: "0 auto" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "0.82fr 1.18fr",
              gap: "56px",
              alignItems: "start",
            }}
          >
            {/* Left: intro */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={VIEWPORT}
              transition={{ duration: 0.6, ease: EASE }}
            >
              <h2
                style={{
                  fontFamily: "'Noto Sans TC', sans-serif",
                  fontWeight: 900,
                  fontSize: "clamp(1.8rem, 3.8vw, 2.6rem)",
                  color: "#111110",
                  margin: "0 0 14px",
                }}
              >
                定價。
              </h2>
              <p
                style={{
                  fontFamily: "'Noto Sans TC', sans-serif",
                  fontSize: "14.5px",
                  lineHeight: 1.85,
                  color: "rgba(17,17,16,0.58)",
                  margin: "0 0 26px",
                  maxWidth: "30ch",
                }}
              >
                按時段收費，愈連訂愈抵玩。所有時段均為獨立球室，價格已包全場設施。
              </p>
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "10px",
                  fontSize: "13px",
                  lineHeight: 1.75,
                  color: "rgba(17,17,16,0.50)",
                  padding: "14px 16px",
                  background: "rgba(255,255,255,0.7)",
                  border: "1px solid rgba(17,17,16,0.09)",
                  borderRadius: "12px",
                  marginBottom: "28px",
                }}
              >
                <Star
                  size={16}
                  color={GOLD}
                  strokeWidth={1.9}
                  style={{ flexShrink: 0, marginTop: 2 }}
                />
                <span>
                  連訂 2 小時或以上可享優惠價，於預訂時自動計算。
                </span>
              </div>
              <Link
                href="/book"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "9px",
                  background: `linear-gradient(180deg, ${GOLD_BRIGHT}, ${GOLD})`,
                  color: "#fff",
                  fontSize: "15px",
                  fontWeight: 500,
                  padding: "15px 34px",
                  borderRadius: "999px",
                  textDecoration: "none",
                  boxShadow: "0 12px 30px -12px rgba(26,157,92,0.65)",
                }}
              >
                立即預訂
                <ChevronRight size={16} strokeWidth={2} />
              </Link>
            </motion.div>

            {/* Right: rate panel */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={VIEWPORT}
              transition={{ duration: 0.6, ease: EASE, delay: 0.1 }}
              style={{
                background: "#ffffff",
                border: "1px solid rgba(17,17,16,0.10)",
                borderRadius: "20px",
                overflow: "hidden",
                boxShadow: "0 2px 8px rgba(17,17,16,0.05)",
              }}
            >
              {/* Row 1: morning */}
              <div
                style={{
                  position: "relative",
                  display: "grid",
                  gridTemplateColumns: "auto 1fr auto",
                  alignItems: "center",
                  gap: "20px",
                  padding: "26px 28px",
                  background: "rgba(26,157,92,0.07)",
                }}
              >
                <div
                  style={{
                    width: "42px",
                    height: "42px",
                    borderRadius: "12px",
                    background: "rgba(26,157,92,0.11)",
                    color: GOLD,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Sun size={21} strokeWidth={1.8} />
                </div>
                <div>
                  <h3
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "9px",
                      fontFamily: "'Noto Sans TC', sans-serif",
                      fontWeight: 700,
                      fontSize: "16.5px",
                      color: "#111110",
                      margin: "0 0 5px",
                    }}
                  >
                    上午時段
                    <span
                      style={{
                        fontSize: "10.5px",
                        fontWeight: 700,
                        color: "#fff",
                        background: GOLD,
                        padding: "3px 9px",
                        borderRadius: "999px",
                        whiteSpace: "nowrap",
                      }}
                    >
                      最抵玩
                    </span>
                  </h3>
                  <p
                    style={{
                      fontSize: "13px",
                      color: "rgba(17,17,16,0.48)",
                      margin: 0,
                    }}
                  >
                    每日 06:00–12:00
                  </p>
                  <span
                    style={{
                      display: "inline-block",
                      marginTop: "8px",
                      fontSize: "12px",
                      color: "#137a46",
                      background: "rgba(26,157,92,0.13)",
                      padding: "5px 11px",
                      borderRadius: "999px",
                    }}
                  >
                    連訂 2 小時或以上 <b style={{ fontWeight: 700 }}>HK$78</b>
                  </span>
                </div>
                <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  <b
                    style={{
                      display: "block",
                      fontWeight: 600,
                      fontSize: "clamp(1.5rem, 2.6vw, 1.95rem)",
                      letterSpacing: "-0.02em",
                      color: "#111110",
                      lineHeight: 1.1,
                    }}
                  >
                    HK$88
                  </b>
                  <span
                    style={{
                      fontSize: "12.5px",
                      color: "rgba(17,17,16,0.45)",
                    }}
                  >
                    / 小時
                  </span>
                </div>
                {/* Left accent bar */}
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: "3px",
                    background: GOLD,
                  }}
                />
              </div>

              {/* Row 2: afternoon */}
              <div
                style={{
                  position: "relative",
                  display: "grid",
                  gridTemplateColumns: "auto 1fr auto",
                  alignItems: "center",
                  gap: "20px",
                  padding: "26px 28px",
                  borderTop: "1px solid rgba(17,17,16,0.09)",
                }}
              >
                <div
                  style={{
                    width: "42px",
                    height: "42px",
                    borderRadius: "12px",
                    background: "rgba(26,157,92,0.11)",
                    color: GOLD,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Star size={21} strokeWidth={1.8} />
                </div>
                <div>
                  <h3
                    style={{
                      fontFamily: "'Noto Sans TC', sans-serif",
                      fontWeight: 700,
                      fontSize: "16.5px",
                      color: "#111110",
                      margin: "0 0 5px",
                    }}
                  >
                    下午時段
                  </h3>
                  <p
                    style={{
                      fontSize: "13px",
                      color: "rgba(17,17,16,0.48)",
                      margin: 0,
                    }}
                  >
                    每日 12:00–16:00
                  </p>
                  <span
                    style={{
                      display: "inline-block",
                      marginTop: "8px",
                      fontSize: "12px",
                      color: "#137a46",
                      background: "rgba(26,157,92,0.13)",
                      padding: "5px 11px",
                      borderRadius: "999px",
                    }}
                  >
                    連訂 2 小時或以上 <b style={{ fontWeight: 700 }}>HK$88</b>
                  </span>
                </div>
                <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  <b
                    style={{
                      display: "block",
                      fontWeight: 600,
                      fontSize: "clamp(1.5rem, 2.6vw, 1.95rem)",
                      letterSpacing: "-0.02em",
                      color: "#111110",
                      lineHeight: 1.1,
                    }}
                  >
                    HK$98
                  </b>
                  <span
                    style={{
                      fontSize: "12.5px",
                      color: "rgba(17,17,16,0.45)",
                    }}
                  >
                    / 小時
                  </span>
                </div>
              </div>

              {/* Row 3: evening */}
              <div
                style={{
                  position: "relative",
                  display: "grid",
                  gridTemplateColumns: "auto 1fr auto",
                  alignItems: "center",
                  gap: "20px",
                  padding: "26px 28px",
                  borderTop: "1px solid rgba(17,17,16,0.09)",
                }}
              >
                <div
                  style={{
                    width: "42px",
                    height: "42px",
                    borderRadius: "12px",
                    background: "rgba(26,157,92,0.11)",
                    color: GOLD,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Moon size={21} strokeWidth={1.8} />
                </div>
                <div>
                  <h3
                    style={{
                      fontFamily: "'Noto Sans TC', sans-serif",
                      fontWeight: 700,
                      fontSize: "16.5px",
                      color: "#111110",
                      margin: "0 0 5px",
                    }}
                  >
                    黃金時段
                  </h3>
                  <p
                    style={{
                      fontSize: "13px",
                      color: "rgba(17,17,16,0.48)",
                      margin: 0,
                    }}
                  >
                    每日 16:00–00:00
                  </p>
                </div>
                <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  <b
                    style={{
                      display: "block",
                      fontWeight: 600,
                      fontSize: "clamp(1.5rem, 2.6vw, 1.95rem)",
                      letterSpacing: "-0.02em",
                      color: "#111110",
                      lineHeight: 1.1,
                    }}
                  >
                    HK$108
                  </b>
                  <span
                    style={{
                      fontSize: "12.5px",
                      color: "rgba(17,17,16,0.45)",
                    }}
                  >
                    / 小時
                  </span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Notes — dark ── */}
      <section
        data-nav-theme="dark"
        style={{
          background: "#1d1d1f",
          padding: "clamp(90px, 10vw, 140px) 24px",
        }}
      >
        <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={VIEWPORT}
            transition={{ duration: 0.6, ease: EASE }}
            style={{
              fontFamily: "'Noto Sans TC', sans-serif",
              fontWeight: 900,
              fontSize: "clamp(1.7rem, 3.4vw, 2.4rem)",
              color: "#f5f2ec",
              margin: "0 0 48px",
            }}
          >
            {t("rules_title")}
          </motion.h2>
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              borderTop: "1px solid rgba(245,242,236,0.10)",
            }}
          >
            {rules.map((rule, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, x: -16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={VIEWPORT}
                transition={{ duration: 0.45, ease: EASE, delay: i * 0.05 }}
                style={{
                  display: "flex",
                  gap: "18px",
                  alignItems: "flex-start",
                  padding: "22px 4px",
                  borderBottom: "1px solid rgba(245,242,236,0.10)",
                }}
              >
                <span
                  style={{
                    flexShrink: 0,
                    width: "26px",
                    height: "26px",
                    borderRadius: "50%",
                    border: `1px solid ${GOLD_BRIGHT}`,
                    color: GOLD_BRIGHT,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "11.5px",
                    fontWeight: 600,
                    marginTop: "1px",
                  }}
                >
                  {i + 1}
                </span>
                <p
                  style={{
                    fontFamily: "'Noto Sans TC', sans-serif",
                    fontSize: "15px",
                    lineHeight: 1.75,
                    color: "#f5f2ec",
                    margin: 0,
                  }}
                >
                  {rule}
                </p>
              </motion.li>
            ))}
          </ul>
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={VIEWPORT}
            transition={{ duration: 0.5, delay: 0.2 }}
            style={{ marginTop: "34px" }}
          >
            <Link
              href="/legal"
              style={{
                display: "inline-block",
                fontSize: "14.5px",
                color: GOLD_BRIGHT,
                textDecoration: "underline",
                textUnderlineOffset: "4px",
                textDecorationThickness: "1px",
              }}
            >
              {t("rules_link")}
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ── Weather — black ── */}
      <section
        data-nav-theme="dark"
        style={{
          background: "#000000",
          padding: "clamp(90px, 10vw, 140px) 24px",
        }}
      >
        <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={VIEWPORT}
            transition={{ duration: 0.55, ease: EASE }}
            style={{
              position: "relative",
              borderRadius: "20px",
              background: "#0b0b0d",
              border: "1px solid rgba(255,255,255,0.26)",
              padding: "46px 44px 48px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "18px",
                marginBottom: "32px",
                position: "relative",
                zIndex: 1,
              }}
            >
              <CloudRain
                size={52}
                color={GOLD_BRIGHT}
                strokeWidth={1.7}
                style={{ flexShrink: 0 }}
              />
              <h2
                style={{
                  fontFamily: "'Noto Sans TC', sans-serif",
                  fontWeight: 900,
                  fontSize: "clamp(1.4rem, 2.8vw, 1.95rem)",
                  color: "#f5f2ec",
                  lineHeight: 1.2,
                  margin: 0,
                }}
              >
                {t("weather_title")}
              </h2>
            </div>

            <div style={{ position: "relative", zIndex: 1 }}>
              <div style={{ marginBottom: "34px" }}>
                <p
                  style={{
                    fontFamily: "'Noto Sans TC', sans-serif",
                    fontWeight: 700,
                    fontSize: "15.5px",
                    color: "#f5f2ec",
                    margin: "0 0 14px",
                  }}
                >
                  颱風警告信號 No. 8 或以上 / 黑色暴雨警告
                </p>
                <ul
                  style={{
                    listStyle: "none",
                    margin: 0,
                    padding: 0,
                  }}
                >
                  <li
                    style={{
                      position: "relative",
                      paddingLeft: "20px",
                      fontSize: "14.5px",
                      lineHeight: 1.9,
                      color: "rgba(245,242,236,0.62)",
                      marginBottom: "10px",
                    }}
                  >
                    <span
                      style={{
                        position: "absolute",
                        left: "2px",
                        top: "0.82em",
                        width: "5px",
                        height: "5px",
                        borderRadius: "50%",
                        background: GOLD_BRIGHT,
                      }}
                    />
                    <b style={{ color: "#f5f2ec", fontWeight: 700 }}>
                      如常開放
                    </b>
                    ：我們的場地自動化系統會維持正常運作。若您評估路面與天氣狀況安全，歡迎按原定時間前來。
                  </li>
                  <li
                    style={{
                      position: "relative",
                      paddingLeft: "20px",
                      fontSize: "14.5px",
                      lineHeight: 1.9,
                      color: "rgba(245,242,236,0.62)",
                      marginBottom: "10px",
                    }}
                  >
                    <span
                      style={{
                        position: "absolute",
                        left: "2px",
                        top: "0.82em",
                        width: "5px",
                        height: "5px",
                        borderRadius: "50%",
                        background: GOLD_BRIGHT,
                      }}
                    />
                    <b style={{ color: "#f5f2ec", fontWeight: 700 }}>
                      貼心改期
                    </b>
                    ：若您評估後希望留在室內休息，請於原本預約時間開始前透過 WhatsApp 聯絡線上客服。我們非常樂意為您安排在 7 天內免費改期一次（本方案不設退款）。
                  </li>
                  <li
                    style={{
                      position: "relative",
                      paddingLeft: "20px",
                      fontSize: "14.5px",
                      lineHeight: 1.9,
                      color: "rgba(245,242,236,0.62)",
                    }}
                  >
                    <span
                      style={{
                        position: "absolute",
                        left: "2px",
                        top: "0.82em",
                        width: "5px",
                        height: "5px",
                        borderRadius: "50%",
                        background: GOLD_BRIGHT,
                      }}
                    />
                    <b style={{ color: "#f5f2ec", fontWeight: 700 }}>
                      溫馨提示
                    </b>
                    ：為確保預約系統運作順暢，改期申請須於預約時間前完成，並請於 7 天內完成使用，逾期將視為放棄該次預約資格權益喔！
                  </li>
                </ul>
              </div>

              <div>
                <p
                  style={{
                    fontFamily: "'Noto Sans TC', sans-serif",
                    fontWeight: 700,
                    fontSize: "15.5px",
                    color: "#f5f2ec",
                    margin: "0 0 14px",
                  }}
                >
                  其他天氣狀況（如 3 號颱風信號、紅色暴雨警告等）
                </p>
                <ul
                  style={{
                    listStyle: "none",
                    margin: 0,
                    padding: 0,
                  }}
                >
                  <li
                    style={{
                      position: "relative",
                      paddingLeft: "20px",
                      fontSize: "14.5px",
                      lineHeight: 1.9,
                      color: "rgba(245,242,236,0.62)",
                    }}
                  >
                    <span
                      style={{
                        position: "absolute",
                        left: "2px",
                        top: "0.82em",
                        width: "5px",
                        height: "5px",
                        borderRadius: "50%",
                        background: GOLD_BRIGHT,
                      }}
                    />
                    除上述極端天氣情況外，場地服務將照常提供。所有已確認的預約，恕無法接受取消、改期或退款，感謝您的理解與配合。
                  </li>
                </ul>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Directions — white ── */}
      <section
        data-nav-theme="light"
        style={{
          background: "#ffffff",
          padding: "clamp(90px, 10vw, 140px) 24px",
        }}
      >
        <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 0.85fr",
              gap: "34px",
              alignItems: "stretch",
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={VIEWPORT}
              transition={{ duration: 0.6, ease: EASE }}
              style={{
                background: "#ffffff",
                border: "1px solid rgba(17,17,16,0.14)",
                borderRadius: "20px",
                padding: "42px 40px 44px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                boxShadow: "0 1px 2px rgba(17,17,16,0.04)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "16px",
                  marginBottom: "28px",
                }}
              >
                <MapPin
                  size={38}
                  color={GOLD}
                  strokeWidth={1.8}
                  style={{ flexShrink: 0 }}
                />
                <h2
                  style={{
                    fontFamily: "'Noto Sans TC', sans-serif",
                    fontWeight: 900,
                    fontSize: "clamp(1.4rem, 2.8vw, 1.95rem)",
                    color: "#111110",
                    lineHeight: 1.2,
                    margin: 0,
                  }}
                >
                  {t("directions_title")}
                </h2>
              </div>

              <p
                style={{
                  fontFamily: "'Noto Sans TC', sans-serif",
                  fontWeight: 700,
                  fontSize: "clamp(16px, 1.9vw, 19px)",
                  lineHeight: 1.6,
                  color: "#111110",
                  margin: "0 0 14px",
                }}
              >
                {ADDRESS}
              </p>

              <ul
                style={{
                  listStyle: "none",
                  margin: "0 0 30px",
                  padding: 0,
                }}
              >
                <li
                  style={{
                    position: "relative",
                    paddingLeft: "17px",
                    fontSize: "13.8px",
                    lineHeight: 1.75,
                    color: "rgba(17,17,16,0.58)",
                    marginBottom: "8px",
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      left: "1px",
                      top: "0.72em",
                      width: "5px",
                      height: "5px",
                      borderRadius: "50%",
                      background: GOLD,
                    }}
                  />
                  港鐵鑽石山站 A2 出口或啟德站 Airside C 出口步行約 8–10 分鐘
                </li>
                <li
                  style={{
                    position: "relative",
                    paddingLeft: "17px",
                    fontSize: "13.8px",
                    lineHeight: 1.75,
                    color: "rgba(17,17,16,0.58)",
                    marginBottom: "8px",
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      left: "1px",
                      top: "0.72em",
                      width: "5px",
                      height: "5px",
                      borderRadius: "50%",
                      background: GOLD,
                    }}
                  />
                  距離鑽石山站 A2 出口 500 米（建議路線）
                </li>
                <li
                  style={{
                    position: "relative",
                    paddingLeft: "17px",
                    fontSize: "13.8px",
                    lineHeight: 1.75,
                    color: "rgba(17,17,16,0.58)",
                    marginBottom: "8px",
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      left: "1px",
                      top: "0.72em",
                      width: "5px",
                      height: "5px",
                      borderRadius: "50%",
                      background: GOLD,
                    }}
                  />
                  亦可乘搭巴士或小巴至大有街附近下車
                </li>
                <li
                  style={{
                    position: "relative",
                    paddingLeft: "17px",
                    fontSize: "13.8px",
                    lineHeight: 1.75,
                    color: "rgba(17,17,16,0.58)",
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      left: "1px",
                      top: "0.72em",
                      width: "5px",
                      height: "5px",
                      borderRadius: "50%",
                      background: GOLD,
                    }}
                  />
                  建議泊車：新科技廣場停車場（威信停車場）
                </li>
              </ul>

              <div
                style={{
                  display: "flex",
                  gap: "14px",
                  flexWrap: "wrap",
                }}
              >
                <a
                  href={MAPS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="venue-dir-cta-button"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "9px",
                    fontSize: "14.5px",
                    fontWeight: 500,
                    padding: "14px 26px",
                    borderRadius: "999px",
                    textDecoration: "none",
                    background: `linear-gradient(180deg, ${GOLD_BRIGHT}, ${GOLD})`,
                    color: "#ffffff",
                    boxShadow: "0 8px 26px -10px rgba(26,157,92,0.55)",
                  }}
                >
                  <MapPin size={17} strokeWidth={1.9} />
                  {t("map_cta")}
                </a>
                <Link
                  href="/book"
                  className="venue-dir-cta-button"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "9px",
                    fontSize: "14.5px",
                    fontWeight: 500,
                    padding: "14px 26px",
                    borderRadius: "999px",
                    textDecoration: "none",
                    background: "transparent",
                    color: "#111110",
                    border: "1px solid rgba(17,17,16,0.22)",
                  }}
                >
                  {t("book_cta")}
                </Link>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={VIEWPORT}
              transition={{ duration: 0.6, ease: EASE, delay: 0.1 }}
              style={{
                position: "relative",
                border: "1px solid rgba(17,17,16,0.14)",
                borderRadius: "20px",
                overflow: "hidden",
                background: "#eceae5",
                minHeight: "380px",
              }}
            >
              <iframe
                src={`https://maps.google.com/maps?q=${encodeURIComponent("香港新蒲崗大有街32號泰力工業中心")}&t=&z=17&ie=UTF8&iwloc=&output=embed`}
                title="泰力工業中心位置地圖"
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
            </motion.div>
          </div>
        </div>
      </section>
    </div>
  );
}