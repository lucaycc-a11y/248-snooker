"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";

type CarouselItem = {
  id: string;
  image: string;
  alt: string;
  category?: string;
  title: string;
  caption: ReactNode;
  detail?: ReactNode;
};

type AppleCardsCarouselProps = {
  heading: string;
  items: CarouselItem[];
  theme?: "light" | "dark";
  className?: string;
};

export function AppleCardsCarousel({
  heading,
  items,
  theme = "dark",
  className = "",
}: AppleCardsCarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [lastFocusedButton, setLastFocusedButton] = useState<HTMLButtonElement | null>(null);

  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(query.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    query.addEventListener("change", handler);
    return () => query.removeEventListener("change", handler);
  }, []);

  const isDark = theme === "dark";
  const tokens = {
    bg: isDark ? "#000000" : "#ffffff",
    surface: isDark ? "#111113" : "#f5f5f7",
    surfaceModal: isDark ? "#161618" : "#ffffff",
    text: isDark ? "#f5f5f7" : "#1d1d1f",
    textMuted: isDark ? "rgba(255,255,255,0.78)" : "rgba(0,0,0,0.7)",
    textBody: isDark ? "#a1a1a6" : "#6e6e73",
    border: isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.1)",
    btnBg: isDark ? "#1d1d1f" : "#e8e8ed",
    btnBgHover: isDark ? "#2c2c2e" : "#d2d2d7",
    plusBg: isDark ? "rgba(255,255,255,0.92)" : "rgba(0,0,0,0.85)",
    plusColor: isDark ? "#111" : "#fff",
    dotInactive: isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.25)",
    dotActive: isDark ? "#22c55e" : "#007aff",
    overlayBg: "rgba(0,0,0,0.72)",
  };

  const syncScroll = () => {
    if (!trackRef.current) return;
    const track = trackRef.current;
    const max = track.scrollWidth - track.clientWidth;
    setCanScrollLeft(track.scrollLeft > 4);
    setCanScrollRight(track.scrollLeft < max - 4);
    const idx = max <= 0 ? 0 : Math.round((track.scrollLeft / max) * (items.length - 1));
    setActiveIndex(idx);
  };

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const handleScroll = () => requestAnimationFrame(syncScroll);
    track.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", syncScroll);
    syncScroll();
    return () => {
      track.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", syncScroll);
    };
  }, [items.length]);

  const getStepWidth = () => {
    if (!trackRef.current) return 300;
    const card = trackRef.current.querySelector("[data-card]") as HTMLElement;
    return card ? card.getBoundingClientRect().width + 20 : 300;
  };

  const scrollPrev = () => {
    trackRef.current?.scrollBy({ left: -getStepWidth(), behavior: "smooth" });
  };

  const scrollNext = () => {
    trackRef.current?.scrollBy({ left: getStepWidth(), behavior: "smooth" });
  };

  const openExpanded = (id: string, button: HTMLButtonElement) => {
    setExpandedId(id);
    setLastFocusedButton(button);
  };

  const closeExpanded = () => {
    setExpandedId(null);
    if (lastFocusedButton) {
      lastFocusedButton.focus();
      setLastFocusedButton(null);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (expandedId) {
        if (e.key === "Escape") closeExpanded();
        return;
      }
      if (e.key === "ArrowRight") scrollNext();
      if (e.key === "ArrowLeft") scrollPrev();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [expandedId]);

  const routineTransition = prefersReducedMotion
    ? { duration: 0 }
    : { duration: 0.35, ease: [0.2, 0.7, 0.3, 1] };

  const popTransition = prefersReducedMotion
    ? { duration: 0 }
    : { duration: 0.5, ease: [0.34, 1.56, 0.64, 1] };

  return (
    <div className={className} style={{ background: tokens.bg }}>
      <style jsx>{`
        @media (max-width: 700px) {
          .carousel-arrows {
            display: none !important;
          }
          .carousel-modal {
            grid-template-columns: 1fr !important;
          }
          .carousel-modal-image {
            min-height: 260px !important;
          }
        }
        @media (min-width: 1440px) {
          .carousel-heading {
            white-space: nowrap;
          }
        }
      `}</style>
      {/* Header */}
      <div
        style={{
          maxWidth: "1280px",
          margin: "0 auto",
          padding: "0 24px 34px",
          display: "flex",
          alignItems: "flex-end",
          gap: "24px",
        }}
      >
        <div style={{ flex: 1 }}>
          <h2
            className="carousel-heading"
            style={{
              fontSize: "clamp(1.75rem, 3.2vw, 3rem)",
              fontWeight: 700,
              lineHeight: 1.2,
              letterSpacing: "-0.04em",
              color: tokens.text,
              textWrap: "balance",
              margin: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {heading}
          </h2>
        </div>

        {/* Arrow controls */}
        <div className="carousel-arrows" style={{ display: "flex", gap: "12px", flex: "0 0 auto" }}>
          <button
            onClick={scrollPrev}
            disabled={!canScrollLeft}
            aria-label="Previous"
            style={{
              width: "46px",
              height: "46px",
              minWidth: "46px",
              minHeight: "46px",
              borderRadius: "50%",
              background: tokens.btnBg,
              border: "none",
              display: "grid",
              placeItems: "center",
              cursor: canScrollLeft ? "pointer" : "default",
              opacity: canScrollLeft ? 1 : 0.3,
              transition: "background 0.2s ease, opacity 0.2s ease",
            }}
            onMouseEnter={(e) => {
              if (canScrollLeft) {
                e.currentTarget.style.background = tokens.btnBgHover;
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = tokens.btnBg;
            }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke={tokens.text}
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ width: "18px", height: "18px" }}
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <button
            onClick={scrollNext}
            disabled={!canScrollRight}
            aria-label="Next"
            style={{
              width: "46px",
              height: "46px",
              minWidth: "46px",
              minHeight: "46px",
              borderRadius: "50%",
              background: tokens.btnBg,
              border: "none",
              display: "grid",
              placeItems: "center",
              cursor: canScrollRight ? "pointer" : "default",
              opacity: canScrollRight ? 1 : 0.3,
              transition: "background 0.2s ease, opacity 0.2s ease",
            }}
            onMouseEnter={(e) => {
              if (canScrollRight) {
                e.currentTarget.style.background = tokens.btnBgHover;
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = tokens.btnBg;
            }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke={tokens.text}
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ width: "18px", height: "18px" }}
            >
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>
        </div>
      </div>

      {/* Track */}
      <div
        ref={trackRef}
        style={{
          display: "flex",
          gap: "20px",
          overflowX: "auto",
          scrollSnapType: "x mandatory",
          scrollBehavior: "smooth",
          padding: "0 max(24px, calc((100vw - 1280px) / 2 + 24px)) 12px",
          scrollPaddingInline: "max(24px, calc((100vw - 1280px) / 2 + 24px))",
          scrollbarWidth: "none",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {items.map((item, index) => (
          <article
            key={item.id}
            data-card
            style={{
              position: "relative",
              flex: "0 0 auto",
              width: "clamp(270px, 28vw, 372px)",
              aspectRatio: "372 / 540",
              borderRadius: "26px",
              overflow: "hidden",
              scrollSnapAlign: index === 0 ? "center" : "start",
              background: tokens.surface,
              transform: "translateZ(0)",
              transition: "transform 0.35s cubic-bezier(0.2, 0.8, 0.3, 1)",
              cursor: "pointer",
            }}
          >
            <Image
              src={item.image}
              alt={item.alt}
              fill
              sizes="(max-width: 768px) 78vw, 372px"
              style={{ objectFit: "cover" }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
                background: isDark
                  ? "linear-gradient(180deg, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.28) 32%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.35) 100%)"
                  : "linear-gradient(180deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 50%, rgba(0,0,0,0.2) 100%)",
              }}
            />
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: 0,
                padding: "26px 26px 0",
                zIndex: 1,
              }}
            >
              {item.category && (
                <div
                  style={{
                    fontSize: "13.5px",
                    fontWeight: 600,
                    color: tokens.textMuted,
                    letterSpacing: "0.02em",
                  }}
                >
                  {item.category}
                </div>
              )}
              <h3
                style={{
                  fontSize: "clamp(21px, 2.1vw, 27px)",
                  fontWeight: 700,
                  lineHeight: 1.3,
                  marginTop: item.category ? "8px" : 0,
                  textWrap: "balance",
                  textShadow: isDark ? "0 2px 18px rgba(0,0,0,0.45)" : "0 1px 8px rgba(255,255,255,0.8)",
                  color: isDark ? "#fff" : "#1d1d1f",
                }}
              >
                {item.title}
              </h3>
            </div>

            {item.detail && (
              <motion.button
                onClick={(e) => {
                  e.preventDefault();
                  openExpanded(item.id, e.currentTarget);
                }}
                aria-label={`View details for ${item.title}`}
                whileHover={{ scale: prefersReducedMotion ? 1 : 1.08 }}
                whileTap={{ scale: prefersReducedMotion ? 1 : 0.95 }}
                transition={popTransition}
                style={{
                  position: "absolute",
                  right: "18px",
                  bottom: "18px",
                  width: "44px",
                  height: "44px",
                  minWidth: "44px",
                  minHeight: "44px",
                  borderRadius: "50%",
                  background: tokens.plusBg,
                  color: tokens.plusColor,
                  border: "none",
                  display: "grid",
                  placeItems: "center",
                  cursor: "pointer",
                  zIndex: 1,
                }}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  style={{ width: "15px", height: "15px" }}
                >
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </motion.button>
            )}
          </article>
        ))}
      </div>

      {/* Dots */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: "8px",
          marginTop: "26px",
        }}
      >
        {items.map((_, index) => (
          <i
            key={index}
            style={{
              display: "block",
              width: index === activeIndex ? "22px" : "7px",
              height: "7px",
              borderRadius: "999px",
              background: index === activeIndex ? tokens.dotActive : tokens.dotInactive,
              transition: "width 0.3s ease, background 0.3s ease",
            }}
          />
        ))}
      </div>

      {/* Expanded Modal */}
      <AnimatePresence>
        {expandedId && (() => {
          const item = items.find((i) => i.id === expandedId);
          if (!item) return null;

          return (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={routineTransition}
              onClick={closeExpanded}
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 50,
                background: tokens.overlayBg,
                backdropFilter: "blur(8px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "24px",
              }}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={popTransition}
                onClick={(e) => e.stopPropagation()}
                className="carousel-modal"
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  width: "min(760px, 100%)",
                  maxHeight: "86vh",
                  background: tokens.surfaceModal,
                  border: `1px solid ${tokens.border}`,
                  borderRadius: "26px",
                  overflow: "hidden",
                }}
              >
                {/* Image */}
                <div
                  className="carousel-modal-image"
                  style={{
                    position: "relative",
                    minHeight: "340px",
                    background: tokens.surface,
                  }}
                >
                  <Image
                    src={item.image}
                    alt={item.alt}
                    fill
                    sizes="760px"
                    style={{ objectFit: "cover" }}
                  />
                </div>

                {/* Content */}
                <div
                  style={{
                    padding: "34px 28px",
                    overflow: "auto",
                    position: "relative",
                  }}
                >
                  <button
                    onClick={closeExpanded}
                    aria-label="Close"
                    style={{
                      position: "absolute",
                      top: "14px",
                      right: "14px",
                      width: "44px",
                      height: "44px",
                      minWidth: "44px",
                      minHeight: "44px",
                      borderRadius: "50%",
                      background: isDark ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.9)",
                      border: `1px solid ${tokens.border}`,
                      display: "grid",
                      placeItems: "center",
                      cursor: "pointer",
                      transition: "background 0.2s",
                      zIndex: 2,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = isDark
                        ? "rgba(0,0,0,0.7)"
                        : "rgba(255,255,255,1)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = isDark
                        ? "rgba(0,0,0,0.5)"
                        : "rgba(255,255,255,0.9)";
                    }}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={tokens.text}
                      strokeWidth="2"
                      strokeLinecap="round"
                      style={{ width: "16px", height: "16px" }}
                    >
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>

                  {item.category && (
                    <div
                      style={{
                        fontSize: "13px",
                        fontWeight: 600,
                        color: tokens.dotActive,
                        paddingRight: "48px",
                      }}
                    >
                      {item.category}
                    </div>
                  )}

                  <h3
                    style={{
                      marginTop: "10px",
                      fontSize: "clamp(22px, 3.4vw, 30px)",
                      fontWeight: 700,
                      lineHeight: 1.28,
                      textWrap: "balance",
                      color: tokens.text,
                    }}
                  >
                    {item.title}
                  </h3>

                  <div
                    style={{
                      marginTop: "12px",
                      fontSize: "15px",
                      lineHeight: 1.7,
                      color: tokens.textMuted,
                      textWrap: "pretty",
                    }}
                  >
                    {item.caption}
                  </div>

                  {item.detail && (
                    <div
                      style={{
                        marginTop: "16px",
                        fontSize: "15px",
                        lineHeight: 1.9,
                        color: tokens.textBody,
                        textWrap: "pretty",
                      }}
                    >
                      {item.detail}
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}