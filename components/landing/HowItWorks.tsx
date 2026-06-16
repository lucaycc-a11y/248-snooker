"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

const DARK = "#1D1D1F";
const GREEN = "#22C55E";

const FONT_FAMILY =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Helvetica, Arial, sans-serif";

const EASE = [0.16, 1, 0.3, 1] as const;
const SPRING = { type: "spring", stiffness: 320, damping: 30 } as const;
const VIEWPORT = { once: true, amount: 0.2 } as const;

const ICON_PROPS = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

// lucide CalendarClock
const CalendarClockIcon = (
  <svg {...ICON_PROPS} width="100%" height="100%" aria-hidden="true">
    <path d="M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5" />
    <path d="M16 2v4M8 2v4M3 10h18" />
    <circle cx="16" cy="16" r="6" />
    <path d="M16 14v2l1.5 1" />
  </svg>
);

// lucide QrCode
const QrCodeIcon = (
  <svg {...ICON_PROPS} width="100%" height="100%" aria-hidden="true">
    <rect x="3" y="3" width="5" height="5" rx="1" />
    <rect x="16" y="3" width="5" height="5" rx="1" />
    <rect x="3" y="16" width="5" height="5" rx="1" />
    <path d="M21 16h-3a2 2 0 0 0-2 2v3M21 21v.01M12 7v3a2 2 0 0 1-2 2H7M3 12h.01M12 3h.01M12 16v.01M16 12h1M21 12v.01M12 21v-1" />
  </svg>
);

// lucide Trophy
const TrophyIcon = (
  <svg {...ICON_PROPS} width="100%" height="100%" aria-hidden="true">
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
    <path d="M4 22h16" />
    <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
    <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
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
    icon: CalendarClockIcon,
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
    icon: QrCodeIcon,
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

// ── Arrow button (shared by header desktop + mobile-below) ──
function ArrowButton({
  dir,
  onClick,
  className,
}: {
  dir: -1 | 1;
  onClick: () => void;
  className?: string;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-label={dir === -1 ? "上一張" : "下一張"}
      whileHover={{ backgroundColor: "#D5D5D5" }}
      transition={SPRING}
      className={className}
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
      {dir === -1 ? "‹" : "›"}
    </motion.button>
  );
}

export default function HowItWorks() {
  const [modal, setModal] = useState<ModalData | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [activeDot, setActiveDot] = useState(0);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Track which card is centered for dot indicators (mobile scroll)
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

  const titleSize = isMobile ? "20px" : "22px";
  const bodySize = isMobile ? "15px" : "16px";

  return (
    <section
      style={{
        background: "#F5F5F7",
        color: DARK,
        padding: "80px 0",
        fontFamily: FONT_FAMILY,
      }}
      data-cms-key="how_it_works_section"
    >
      {/* Header row */}
      <div
        style={{
          maxWidth: "1100px",
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
          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={VIEWPORT}
            transition={{ duration: 0.6, ease: EASE }}
            style={{
              fontSize: "clamp(36px, 5vw, 48px)",
              fontWeight: 700,
              letterSpacing: "-0.03em",
              color: DARK,
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
          <ArrowButton dir={-1} onClick={() => nudge(-1)} className="flex" />
          <ArrowButton dir={1} onClick={() => nudge(1)} className="flex" />
        </div>
      </div>

      {/* Cards — desktop: equal-width row; mobile: snap scroll */}
      <div
        ref={trackRef}
        className="no-scrollbar"
        style={{
          maxWidth: "1100px",
          margin: "0 auto",
          padding: "0 24px",
          display: "flex",
          gap: "16px",
          overflowX: isMobile ? "auto" : "visible",
          scrollSnapType: isMobile ? "x mandatory" : undefined,
          WebkitOverflowScrolling: "touch",
          alignItems: "stretch",
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
            style={{
              position: "relative",
              flex: isMobile ? "0 0 auto" : "1 1 0",
              minWidth: isMobile ? "80vw" : 0,
              scrollSnapAlign: isMobile ? "start" : undefined,
              background: "white",
              border: "1px solid #E5E5E5",
              borderRadius: "18px",
              padding: "28px",
              minHeight: "240px",
              display: "flex",
              flexDirection: "column",
            }}
            data-cms-key={step.key}
          >
            <div style={{ width: "28px", height: "28px", color: step.accent, marginBottom: "20px" }}>
              {step.icon}
            </div>
            <h3 style={{ fontSize: titleSize, fontWeight: 700, letterSpacing: "-0.01em", color: DARK, margin: "0 0 12px" }}>
              {step.title}
            </h3>
            <p style={{ fontSize: bodySize, lineHeight: 1.6, color: DARK, margin: 0 }}>
              {highlight(step.body, step.highlights, step.accent)}
            </p>

            {/* + button — solid black, white glyph */}
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
              whileHover={{ scale: 1.05 }}
              transition={SPRING}
              style={{
                position: "absolute",
                bottom: "16px",
                right: "16px",
                width: "44px",
                height: "44px",
                borderRadius: "50%",
                border: "none",
                background: DARK,
                color: "white",
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

      {/* Mobile controls — arrows flank dots, centred below cards */}
      <div
        className="flex md:hidden"
        style={{
          justifyContent: "center",
          alignItems: "center",
          gap: "16px",
          marginTop: "32px",
        }}
      >
        <ArrowButton dir={-1} onClick={() => nudge(-1)} className="flex" />
        <div style={{ display: "flex", gap: "8px" }}>
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
        <ArrowButton dir={1} onClick={() => nudge(1)} className="flex" />
      </div>

      <Modal data={modal} onClose={() => setModal(null)} />
    </section>
  );
}
