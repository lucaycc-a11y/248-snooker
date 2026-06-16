"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

const GREEN_LIGHT = "#22C55E";
const DARK = "#1D1D1F";
const BORDER = "#2D2D2D";

const FONT_FAMILY =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Helvetica, Arial, sans-serif";

const EASE = [0.16, 1, 0.3, 1] as const;
const SPRING = { type: "spring", stiffness: 320, damping: 30 } as const;
const VIEWPORT = { once: true, amount: 0.2 } as const;

const ICON_PROPS = {
  viewBox: "0 0 48 48",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const UserIcon = (
  <svg {...ICON_PROPS} width="100%" height="100%" aria-hidden="true">
    <circle cx="24" cy="16" r="8" />
    <path d="M10 40c0-7.7 6.3-14 14-14s14 6.3 14 14" />
  </svg>
);

const TrophyIcon = (
  <svg {...ICON_PROPS} width="100%" height="100%" aria-hidden="true">
    <path d="M14 8h20v9a10 10 0 0 1-20 0z" />
    <path d="M14 11H8v3a6 6 0 0 0 6 6M34 11h6v3a6 6 0 0 1-6 6" />
    <path d="M24 27v7M17 40h14M20 40v-3a4 4 0 0 1 8 0v3" />
  </svg>
);

const StarIcon = (
  <svg {...ICON_PROPS} width="100%" height="100%" aria-hidden="true">
    <path d="M24 6l5.6 11.4L42 19l-9 8.8L35.2 40 24 34.2 12.8 40 15 27.8 6 19l12.4-1.6z" />
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

interface TierCard {
  key: string;
  icon: React.ReactNode;
  accent: string;
  title: string;
  subtitle?: string;
  badge?: string;
  body: string;
  highlights: string[];
  modalBody: string;
}

const cards: TierCard[] = [
  {
    key: "tier_amateur",
    icon: UserIcon,
    accent: "#22C55E",
    title: "Amateur",
    body: "HK$1 = 1 積分。每月免費一局。",
    highlights: ["每月免費一局"],
    modalBody:
      "新用戶自動加入 Amateur 等級，即時獲贈 50 積分。每消費 HK$1 累積 1 積分，每月享一局免費時段。開始你的旅程，輕鬆累積。",
  },
  {
    key: "tier_century",
    icon: TrophyIcon,
    accent: "#F59E0B",
    title: "Century",
    subtitle: "500 積分起",
    body: "全場時段 9 折。優先預訂熱門時段。積分 1.5 倍加速。",
    highlights: ["9 折", "1.5 倍"],
    modalBody:
      "累積 500 積分晉升 Century 等級。全場所有時段享 9 折優惠，可優先預訂晚上熱門時段，積分以 1.5 倍速度累積，升級更快。",
  },
  {
    key: "tier_maximum",
    icon: StarIcon,
    accent: "#A78BFA",
    title: "Maximum",
    subtitle: "1,500 積分起",
    badge: "最高等級",
    body: "全場時段 8 折。專屬球桌保留權。積分雙倍，免費教練時段。",
    highlights: ["8 折", "積分雙倍", "免費教練時段"],
    modalBody:
      "累積 1,500 積分達到 Maximum 最高等級。全場時段 8 折，享專屬球桌保留權，積分雙倍累積，並可預約免費教練時段。為最投入的玩家而設。",
  },
];

interface ModalData {
  label: string;
  title: string;
  body: string;
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
            background: "rgba(0,0,0,0.6)",
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
              border: `1px solid ${BORDER}`,
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
                color: GREEN_LIGHT,
                margin: "0 0 12px",
              }}
            >
              {data.label}
            </p>
            <h3 style={{ fontSize: "32px", fontWeight: 600, letterSpacing: "-0.02em", margin: "0 0 16px" }}>
              {data.title}
            </h3>
            <p style={{ fontSize: "17px", lineHeight: 1.6, color: "rgba(255,255,255,0.75)", margin: "0 0 24px" }}>
              {data.body}
            </p>
            <a
              href="/member"
              className="group inline-flex items-center"
              style={{ color: GREEN_LIGHT, fontSize: "17px", textDecoration: "none", gap: "2px" }}
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

export default function Member() {
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
    const next = Math.min(cards.length - 1, Math.max(0, activeDot + dir));
    scrollToCard(next);
  };

  return (
    <section
      style={{ background: "#F5F5F7", color: DARK, padding: "120px 0", fontFamily: FONT_FAMILY }}
      data-cms-key="membership_section"
    >
      {/* Header row */}
      <div
        style={{
          maxWidth: "1200px",
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
        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={VIEWPORT}
          transition={{ duration: 0.6, ease: EASE }}
          style={{ fontSize: "clamp(32px, 5vw, 56px)", fontWeight: 800, letterSpacing: "-0.03em", margin: 0, color: "#86868B" }}
          data-cms-key="membership_title"
        >
          愈打愈著數。
        </motion.h2>

        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <a
            href="/member"
            className="group inline-flex items-center"
            style={{ color: GREEN_LIGHT, fontSize: "19px", textDecoration: "none", gap: "2px", whiteSpace: "nowrap" }}
            data-cms-key="membership_link"
          >
            <span className="group-hover:underline">了解會員計劃</span>
            <span aria-hidden="true">›</span>
          </a>

          {/* Desktop arrows */}
          <div className="hidden md:flex" style={{ gap: "8px" }}>
            {([-1, 1] as const).map((dir) => (
              <motion.button
                key={dir}
                type="button"
                onClick={() => nudge(dir)}
                aria-label={dir === -1 ? "上一張" : "下一張"}
                whileHover={{ backgroundColor: "#3A3A3A" }}
                transition={SPRING}
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  border: "none",
                  background: "#2D2D2D",
                  color: "white",
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
        }}
      >
        {cards.map((card, i) => (
          <motion.div
            key={card.key}
            ref={(el) => {
              cardRefs.current[i] = el;
            }}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.5, ease: EASE, delay: 0.05 * i }}
            className="group/card snap-start shrink-0"
            style={{
              width: "min(85vw, 360px)",
              minHeight: "380px",
              background: DARK,
              border: `1px solid ${BORDER}`,
              borderRadius: "24px",
              padding: "32px",
              position: "relative",
              display: "flex",
              flexDirection: "column",
              transition: "border-color 0.3s ease",
            }}
            data-cms-key={card.key}
          >
            {/* hover border uses the card's accent */}
            <style>{`[data-cms-key="${card.key}"]:hover{border-color:${card.accent} !important;}`}</style>

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

            <div style={{ width: "44px", height: "44px", color: card.accent, marginBottom: "24px" }}>
              {card.icon}
            </div>

            <h3 style={{ fontSize: "26px", fontWeight: 700, letterSpacing: "-0.02em", margin: "0 0 4px" }}>
              {card.title}
            </h3>
            {card.subtitle && (
              <p style={{ fontSize: "15px", color: card.accent, fontWeight: 500, margin: "0 0 16px" }}>
                {card.subtitle}
              </p>
            )}
            <p
              style={{
                fontSize: "15px",
                lineHeight: 1.6,
                color: "rgba(245,245,245,0.7)",
                margin: card.subtitle ? "0" : "12px 0 0",
              }}
            >
              {highlight(card.body, card.highlights, card.accent)}
            </p>

            {/* + button — Apple proportion: 16px glyph in 44px circle (≈36%) */}
            <motion.button
              type="button"
              onClick={() => setModal({ label: "會員等級", title: card.title, body: card.modalBody })}
              aria-label={`展開「${card.title}」詳細說明`}
              whileHover={{ scale: 1.08, backgroundColor: "rgba(255,255,255,0.22)" }}
              transition={SPRING}
              style={{
                position: "absolute",
                bottom: "24px",
                right: "24px",
                width: "44px",
                height: "44px",
                borderRadius: "50%",
                border: "1.5px solid rgba(255,255,255,0.25)",
                background: "rgba(255,255,255,0.15)",
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
          whileHover={{ backgroundColor: "#3A3A3A" }}
          transition={SPRING}
          className="flex md:hidden"
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "50%",
            border: "none",
            background: "#2D2D2D",
            color: "white",
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
          {cards.map((card, i) => (
            <button
              key={card.key}
              type="button"
              onClick={() => scrollToCard(i)}
              aria-label={`前往第 ${i + 1} 張`}
              style={{
                width: activeDot === i ? "24px" : "8px",
                height: "8px",
                borderRadius: "100px",
                border: "none",
                background: activeDot === i ? card.accent : "rgba(0,0,0,0.18)",
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
          whileHover={{ backgroundColor: "#3A3A3A" }}
          transition={SPRING}
          className="flex md:hidden"
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "50%",
            border: "none",
            background: "#2D2D2D",
            color: "white",
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
