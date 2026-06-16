"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

const GREEN = "#22C55E";
const DARK = "#1D1D1F";

const FONT_FAMILY =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Helvetica, Arial, sans-serif";

const EASE = [0.16, 1, 0.3, 1] as const;
const SPRING = { type: "spring", stiffness: 320, damping: 30 } as const;
const VIEWPORT = { once: true, amount: 0.2 } as const;

const ICON_PROPS = {
  viewBox: "0 0 48 48",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const CalendarIcon = (
  <svg {...ICON_PROPS} width="100%" height="100%" aria-hidden="true">
    <rect x="8" y="10" width="32" height="30" rx="5" />
    <path d="M8 18h32" />
    <path d="M17 6v8M31 6v8" />
    <circle cx="24" cy="29" r="6" />
    <path d="M24 26v3l2 2" />
  </svg>
);

const QrIcon = (
  <svg {...ICON_PROPS} width="100%" height="100%" aria-hidden="true">
    <rect x="7" y="7" width="13" height="13" rx="2" />
    <rect x="28" y="7" width="13" height="13" rx="2" />
    <rect x="7" y="28" width="13" height="13" rx="2" />
    <path d="M28 28h6v6h-6zM41 28v6M34 41h7M28 36v5" />
  </svg>
);

const TrophyIcon = (
  <svg {...ICON_PROPS} width="100%" height="100%" aria-hidden="true">
    <path d="M14 8h20v9a10 10 0 0 1-20 0z" />
    <path d="M14 11H8v3a6 6 0 0 0 6 6M34 11h6v3a6 6 0 0 1-6 6" />
    <path d="M24 27v7M17 40h14M20 40v-3a4 4 0 0 1 8 0v3" />
  </svg>
);

// Wrap each key word in an accent-coloured span (Apple-style inline highlight)
function highlight(text: string, words: string[], color: string): React.ReactNode {
  if (!words.length) return text;
  const escaped = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const parts = text.split(new RegExp(`(${escaped.join("|")})`, "g"));
  return parts.map((part, i) =>
    words.includes(part) ? (
      <span key={i} style={{ color, fontWeight: 600 }}>
        {part}
      </span>
    ) : (
      part
    )
  );
}

interface Step {
  key: string;
  icon: React.ReactNode;
  accent: string;
  title: string;
  body: string;
  highlights: string[];
  modalLabel: string;
  modalTitle: string;
  modalBody: string;
}

const steps: Step[] = [
  {
    key: "step_book",
    icon: CalendarIcon,
    accent: "#0071E3",
    title: "選擇時段",
    body: "選擇日期、時間及時長。即時確認，毋需等候。",
    highlights: ["即時確認"],
    modalLabel: "預訂",
    modalTitle: "選擇時段",
    modalBody:
      "全程線上預訂，三步完成。選擇日期、時間及時長後即時確認，毋需等候人手回覆。付款支援 Apple Pay、Visa、Mastercard 及 UnionPay，安全快捷。",
  },
  {
    key: "step_qr",
    icon: QrIcon,
    accent: "#22C55E",
    title: "掃碼入場",
    body: "預訂確認後即獲 QR 碼。到場掃描，自動開門。",
    highlights: ["自動開門"],
    modalLabel: "入場",
    modalTitle: "掃碼入場",
    modalBody:
      "預訂確認後即時獲發專屬 QR 碼，於預訂時段內有效。到場時於門鎖掃描即自動開門，全程無需職員協助。QR 碼僅限預訂時段使用，安全可靠。",
  },
  {
    key: "step_points",
    icon: TrophyIcon,
    accent: "#F59E0B",
    title: "累積積分",
    body: "每 HK$1 累積 1 積分。愈打愈著數。",
    highlights: ["愈打愈著數"],
    modalLabel: "獎賞",
    modalTitle: "累積積分",
    modalBody:
      "每消費 HK$1 即累積 1 積分，自動升級會員等級。三個等級 Amateur、Century、Maximum，分別享有折扣、優先預訂及免費教練時段等專屬福利。",
  },
];

interface ModalData {
  label: string;
  title: string;
  body: string;
  href: string;
}

function Modal({ data, onClose }: { data: ModalData | null; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    if (data) {
      document.addEventListener("keydown", onKey);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [data, onClose]);

  return (
    <AnimatePresence>
      {data && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            background: "rgba(0,0,0,0.5)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
          }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={SPRING}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "relative",
              width: "100%",
              maxWidth: "520px",
              background: DARK,
              borderRadius: "24px",
              padding: "40px",
              color: "white",
              fontFamily: FONT_FAMILY,
            }}
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="關閉"
              style={{
                position: "absolute",
                top: "20px",
                right: "20px",
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                border: "none",
                background: "rgba(255,255,255,0.1)",
                color: "white",
                fontSize: "18px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              ×
            </button>

            <p
              style={{
                fontSize: "13px",
                fontWeight: 500,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.5)",
                margin: "0 0 12px",
              }}
            >
              {data.label}
            </p>
            <h3
              style={{
                fontSize: "32px",
                fontWeight: 600,
                letterSpacing: "-0.02em",
                margin: "0 0 16px",
              }}
            >
              {data.title}
            </h3>
            <p
              style={{
                fontSize: "17px",
                lineHeight: 1.6,
                color: "rgba(255,255,255,0.75)",
                margin: "0 0 24px",
              }}
            >
              {data.body}
            </p>
            <a
              href={data.href}
              className="group inline-flex items-center"
              style={{ color: GREEN, fontSize: "17px", textDecoration: "none", gap: "2px" }}
            >
              <span className="group-hover:underline">了解更多</span>
              <span aria-hidden="true">›</span>
            </a>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function HowItWorks() {
  const [modal, setModal] = useState<ModalData | null>(null);
  const [activeDot, setActiveDot] = useState(0);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Track which card is centered for dot indicators
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const onScroll = () => {
      const center = track.scrollLeft + track.clientWidth / 2;
      let nearest = 0;
      let min = Infinity;
      cardRefs.current.forEach((el, i) => {
        if (!el) return;
        const cardCenter = el.offsetLeft + el.offsetWidth / 2;
        const dist = Math.abs(cardCenter - center);
        if (dist < min) {
          min = dist;
          nearest = i;
        }
      });
      setActiveDot(nearest);
    };
    track.addEventListener("scroll", onScroll, { passive: true });
    return () => track.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToCard = (i: number) => {
    const el = cardRefs.current[i];
    const track = trackRef.current;
    if (!el || !track) return;
    track.scrollTo({ left: el.offsetLeft - 24, behavior: "smooth" });
  };

  const nudge = (dir: -1 | 1) => {
    const next = Math.min(steps.length - 1, Math.max(0, activeDot + dir));
    scrollToCard(next);
  };

  return (
    <section
      style={{
        background: "#F5F5F7",
        color: DARK,
        padding: "120px 0",
        fontFamily: FONT_FAMILY,
      }}
      data-cms-key="how_it_works_section"
    >
      {/* Header row */}
      <div
        style={{
          maxWidth: "1040px",
          margin: "0 auto",
          padding: "0 24px",
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: "16px",
          flexWrap: "wrap",
          marginBottom: "48px",
        }}
      >
        <div>
          {/* Heading */}
          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={VIEWPORT}
            transition={{ duration: 0.6, ease: EASE }}
            style={{
              fontSize: "clamp(36px, 5vw, 48px)",
              fontWeight: 700,
              letterSpacing: "-0.03em",
              margin: "0 0 12px",
            }}
            data-cms-key="how_it_works_title"
          >
            預訂流程。
          </motion.h2>
          <motion.a
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={VIEWPORT}
            transition={{ duration: 0.6, ease: EASE, delay: 0.05 }}
            href="/about"
            className="group inline-flex items-center"
            style={{ color: GREEN, fontSize: "19px", textDecoration: "none", gap: "6px" }}
            data-cms-key="how_it_works_link"
          >
            <span
              aria-hidden="true"
              style={{ width: "7px", height: "7px", borderRadius: "50%", background: GREEN, flexShrink: 0 }}
            />
            <span className="group-hover:underline">了解更多關於預訂</span>
            <span aria-hidden="true">›</span>
          </motion.a>
        </div>

        {/* Desktop arrows */}
        <div className="hidden md:flex" style={{ gap: "8px" }}>
          {([-1, 1] as const).map((dir) => (
            <motion.button
              key={dir}
              type="button"
              onClick={() => nudge(dir)}
              aria-label={dir === -1 ? "上一張" : "下一張"}
              whileHover={{ backgroundColor: "#D5D5D5" }}
              transition={SPRING}
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                border: "none",
                background: "#E5E5E5",
                color: DARK,
                fontSize: "18px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 0,
              }}
            >
              {dir === -1 ? "‹" : "›"}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Carousel track */}
      <div
        ref={trackRef}
        className="no-scrollbar"
        style={{
          display: "flex",
          gap: "20px",
          overflowX: "auto",
          scrollSnapType: "x mandatory",
          padding: "8px 24px",
          scrollPaddingLeft: "24px",
          WebkitOverflowScrolling: "touch",
          maxWidth: "1088px",
          margin: "0 auto",
        }}
      >
        {steps.map((step, i) => (
          <motion.div
            key={step.key}
            ref={(el) => {
              cardRefs.current[i] = el;
            }}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={VIEWPORT}
            transition={{ duration: 0.5, ease: EASE, delay: 0.08 * i }}
            className="snap-start shrink-0"
            style={{
              position: "relative",
              width: "min(85vw, 320px)",
              background: DARK,
              border: "1px solid #2D2D2D",
              borderRadius: "20px",
              padding: "32px",
              minHeight: "260px",
              display: "flex",
              flexDirection: "column",
            }}
            data-cms-key={step.key}
          >
            <div style={{ width: "44px", height: "44px", color: "white", marginBottom: "24px" }}>
              {step.icon}
            </div>
            <h3 style={{ fontSize: "20px", fontWeight: 600, letterSpacing: "-0.01em", margin: "0 0 8px", color: "white" }}>
              {step.title}
            </h3>
            <p style={{ fontSize: "15px", lineHeight: 1.6, color: "#86868B", margin: 0 }}>
              {highlight(step.body, step.highlights, step.accent)}
            </p>

            {/* + button — Apple proportion: 16px glyph in 44px circle (≈36%) */}
            <motion.button
              type="button"
              onClick={() =>
                setModal({
                  label: step.modalLabel,
                  title: step.modalTitle,
                  body: step.modalBody,
                  href: "/about",
                })
              }
              aria-label={`展開「${step.title}」詳細說明`}
              whileHover={{ scale: 1.08, backgroundColor: "#F5F5F7" }}
              transition={SPRING}
              style={{
                position: "absolute",
                bottom: "24px",
                right: "24px",
                width: "44px",
                height: "44px",
                borderRadius: "50%",
                border: "1.5px solid rgba(0,0,0,0.12)",
                background: "white",
                color: DARK,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 0,
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M8 3v10M3 8h10" />
              </svg>
            </motion.button>
          </motion.div>
        ))}
      </div>

      {/* Controls below cards — mobile arrows flank the dots; desktop shows dots only */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: "16px",
          marginTop: "32px",
        }}
      >
        {/* Mobile-only left arrow */}
        <motion.button
          type="button"
          onClick={() => nudge(-1)}
          aria-label="上一張"
          whileHover={{ backgroundColor: "#D5D5D5" }}
          transition={SPRING}
          className="flex md:hidden"
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "50%",
            border: "none",
            background: "#E5E5E5",
            color: DARK,
            fontSize: "18px",
            cursor: "pointer",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
            flexShrink: 0,
          }}
        >
          ‹
        </motion.button>

        {/* Dot indicators */}
        <div style={{ display: "flex", justifyContent: "center", gap: "8px" }}>
          {steps.map((step, i) => (
            <button
              key={step.key}
              type="button"
              onClick={() => scrollToCard(i)}
              aria-label={`前往第 ${i + 1} 張`}
              style={{
                width: activeDot === i ? "24px" : "8px",
                height: "8px",
                borderRadius: "100px",
                border: "none",
                background: activeDot === i ? step.accent : "rgba(0,0,0,0.18)",
                cursor: "pointer",
                transition: "all 0.3s ease",
                padding: 0,
              }}
            />
          ))}
        </div>

        {/* Mobile-only right arrow */}
        <motion.button
          type="button"
          onClick={() => nudge(1)}
          aria-label="下一張"
          whileHover={{ backgroundColor: "#D5D5D5" }}
          transition={SPRING}
          className="flex md:hidden"
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "50%",
            border: "none",
            background: "#E5E5E5",
            color: DARK,
            fontSize: "18px",
            cursor: "pointer",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
            flexShrink: 0,
          }}
        >
          ›
        </motion.button>
      </div>

      <Modal data={modal} onClose={() => setModal(null)} />
    </section>
  );
}
