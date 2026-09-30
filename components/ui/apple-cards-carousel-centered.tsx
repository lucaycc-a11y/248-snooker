"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Play, X, Plus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type Slide = {
  eyebrow?: string;
  title: string;
  desc?: string;
  detailedDesc?: string;
  src: string;
  alt?: string;
  altCmsKey?: string;
  focus?: "center" | "center top" | "center bottom";
  width?: number;
  height?: number;
  aspectRatio?: string;
  objectFit?: "cover" | "contain";
  badge?: string;
  badgeBg?: string;
  darkTheme?: boolean;
};

type AppleCarouselCenteredProps = {
  slides: Slide[];
  autoplayInterval?: number;
  aspectRatio?: string;
  onIndexChange?: (index: number) => void;
  viewDetailsLabel?: string;
  closeLabel?: string;
};

function parseBoldText(text: string, darkTheme: boolean) {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  const boldRegex = /\*\*(.*?)\*\*/g;
  let match;

  while ((match = boldRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(
      <strong key={match.index} style={{ fontWeight: 600, color: darkTheme ? "#fff" : "#111" }}>
        {match[1]}
      </strong>
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}

export function AppleCarouselCentered({
  slides,
  autoplayInterval = 5000,
  aspectRatio = "3 / 4.1",
  onIndexChange,
  viewDetailsLabel = "查看詳情",
  closeLabel = "關閉",
}: AppleCarouselCenteredProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>();

  const [activeIndex, setActiveIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [isInViewport, setIsInViewport] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetSlideIndex, setSheetSlideIndex] = useState<number | null>(null);
  const [buttonThatOpenedSheet, setButtonThatOpenedSheet] = useState<HTMLButtonElement | null>(null);

  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(query.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    query.addEventListener("change", handler);
    return () => query.removeEventListener("change", handler);
  }, []);

  const autoplayStateRef = useRef({ elapsedMs: 0, lastFrameTime: 0 });
  const shouldAutoplay = isPlaying && !isPaused && isInViewport && !sheetOpen && !(typeof document !== 'undefined' && document.hidden);

  const updateActiveIndex = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;

    const trackCenterX = track.scrollLeft + track.clientWidth / 2;
    let closest = 0;
    let minDist = Infinity;

    Array.from(track.children).forEach((child, i) => {
      if (i === 0 || i === track.children.length - 1) return;
      const el = child as HTMLElement;
      const childCenter = el.offsetLeft + el.offsetWidth / 2;
      const dist = Math.abs(trackCenterX - childCenter);
      if (dist < minDist) {
        minDist = dist;
        closest = i - 1;
      }
    });

    if (closest !== activeIndex) {
      setActiveIndex(closest);
      onIndexChange?.(closest);
    }
  }, [activeIndex, onIndexChange]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const handleScroll = () => updateActiveIndex();
    track.addEventListener("scroll", handleScroll, { passive: true });
    return () => track.removeEventListener("scroll", handleScroll);
  }, [updateActiveIndex]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsInViewport(entry.isIntersecting),
      { threshold: 0.1 }
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {};
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  useEffect(() => {
    if (!shouldAutoplay) {
      autoplayStateRef.current.elapsedMs = 0;
      return;
    }

    const autoplayTick = (now: number) => {
      const state = autoplayStateRef.current;
      if (state.lastFrameTime === 0) state.lastFrameTime = now;

      const delta = now - state.lastFrameTime;
      state.lastFrameTime = now;
      state.elapsedMs += delta;

      if (state.elapsedMs >= autoplayInterval) {
        state.elapsedMs = 0;
        state.lastFrameTime = now;

        setActiveIndex((prev) => {
          const next = (prev + 1) % slides.length;
          const track = trackRef.current;
          if (track) {
            const nextEl = track.children[next + 1] as HTMLElement;
            if (nextEl) {
              nextEl.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
            }
          }
          return next;
        });
      }

      rafRef.current = requestAnimationFrame(autoplayTick);
    };

    rafRef.current = requestAnimationFrame(autoplayTick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [shouldAutoplay, slides.length, autoplayInterval]);

  const scrollToSlide = (index: number) => {
    const track = trackRef.current;
    if (!track) return;
    const el = track.children[index + 1] as HTMLElement;
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  };

  const toggleAutoplay = () => {
    setIsPlaying((prev) => !prev);
    autoplayStateRef.current.elapsedMs = 0;
    autoplayStateRef.current.lastFrameTime = 0;
  };

  const openSheet = (index: number, button: HTMLButtonElement) => {
    setSheetSlideIndex(index);
    setSheetOpen(true);
    setButtonThatOpenedSheet(button);
    document.body.style.overflow = "hidden";
  };

  const closeSheet = () => {
    setSheetOpen(false);
    setSheetSlideIndex(null);
    document.body.style.overflow = "";
    if (buttonThatOpenedSheet) {
      buttonThatOpenedSheet.focus();
      setButtonThatOpenedSheet(null);
    }
  };

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && sheetOpen) closeSheet();
    };
    if (sheetOpen) {
      document.addEventListener("keydown", handleEsc);
      return () => document.removeEventListener("keydown", handleEsc);
    }
  }, [sheetOpen]);

  const cardWidth = typeof window !== "undefined" ? Math.min(window.innerWidth * 0.72, 560) : 560;
  const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1024;
  const spacerWidth = Math.max(0, (viewportWidth - cardWidth) / 2);

  const currentSlide = sheetSlideIndex !== null ? slides[sheetSlideIndex] : null;

  return (
    <div ref={containerRef} className="w-full">
      <style jsx>{`
        .carousel-track-centered {
          display: flex;
          gap: 20px;
          overflow-x: auto;
          scroll-snap-type: x mandatory;
          overscroll-behavior-x: contain;
          scroll-behavior: smooth;
          transform: translateZ(0);
          isolation: isolate;
        }

        .carousel-spacer {
          flex-shrink: 0;
          width: ${spacerWidth}px;
        }

        .carousel-slide-centered {
          flex-shrink: 0;
          width: min(72vw, 560px);
          scroll-snap-align: center;
          scroll-snap-stop: always;
          border-radius: 32px;
          overflow: hidden;
          position: relative;
          will-change: transform;
          border: 1px solid rgba(0, 0, 0, 0.08);
        }

        .carousel-slide-centered[data-landscape="true"] {
          width: min(80vw, 720px);
        }

        .carousel-media-centered {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center;
        }

        .carousel-media-contain {
          object-fit: contain;
        }

        .carousel-overlay-centered {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            to top,
            rgba(0, 0, 0, 0.75) 0%,
            rgba(0, 0, 0, 0.05) 70%,
            transparent 100%
          );
        }

        .carousel-text-centered {
          position: absolute;
          top: 24px;
          left: 24px;
          right: 80px;
          display: flex;
          flex-direction: column;
          color: white;
          z-index: 2;
        }

        .carousel-eyebrow-centered {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.65);
          margin-bottom: 8px;
        }

        .carousel-title-centered {
          font-size: clamp(22px, 4vw, 32px);
          font-weight: 600;
          line-height: 1.1;
          letter-spacing: -0.02em;
        }

        .carousel-plus-btn {
          position: absolute;
          bottom: 24px;
          right: 24px;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: rgba(0, 0, 0, 0.55);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.18);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: white;
          transition: all 200ms ease;
          z-index: 3;
        }

        .carousel-plus-btn:hover {
          background: rgba(0, 0, 0, 0.75);
          transform: scale(1.05);
        }

        .carousel-pagination-centered {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-top: 24px;
          padding: 12px 16px;
          background: rgba(0, 0, 0, 0.4);
          backdrop-filter: blur(10px);
          border-radius: 999px;
          width: fit-content;
          margin-left: auto;
          margin-right: auto;
        }

        .carousel-dot-centered {
          height: 8px;
          background: rgba(255, 255, 255, 0.3);
          border-radius: 4px;
          cursor: pointer;
          transition: all 300ms ease;
          flex-shrink: 0;
          width: 8px;
        }

        .carousel-dot-centered.active {
          width: 48px;
          background: white;
          position: relative;
        }

        .carousel-dot-progress-centered {
          position: absolute;
          left: 0;
          top: 0;
          height: 100%;
          background: rgba(37, 211, 102, 0.8);
          border-radius: 4px;
          transform-origin: left;
          transform: scaleX(var(--progress, 0));
          transition: transform 100ms linear;
        }

        .carousel-play-pause-centered {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.15);
          border: 1px solid rgba(255, 255, 255, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: white;
          transition: all 200ms ease;
          margin-left: 12px;
          flex-shrink: 0;
        }

        .carousel-play-pause-centered:hover {
          background: rgba(255, 255, 255, 0.25);
        }
      `}</style>

      <div
        ref={trackRef}
        className="carousel-track-centered no-scrollbar"
        role="region"
        aria-label="Carousel"
        aria-live="polite"
      >
        <div className="carousel-spacer" aria-hidden="true" />
        {slides.map((slide, i) => (
          <div
            key={i}
            className="carousel-slide-centered"
            role="tabpanel"
            aria-selected={i === activeIndex}
            data-landscape={slide.aspectRatio ? (parseFloat(slide.aspectRatio.split("/")[0] ?? "1") > parseFloat(slide.aspectRatio.split("/")[1] ?? "1") ? "true" : "false") : "false"}
            style={{ aspectRatio: slide.aspectRatio ?? aspectRatio }}
          >
            <Image
              src={slide.src}
              alt={slide.alt || slide.title}
              data-cms-key={slide.altCmsKey}
              fill
              sizes="(max-width: 768px) 72vw, (max-width: 1024px) 560px, 720px"
              quality={80}
              priority={i === 0}
              className={`carousel-media-centered${slide.objectFit === "contain" ? " carousel-media-contain" : ""}`}
              style={{
                objectPosition: slide.focus || "center",
                objectFit: slide.objectFit === "contain" ? "contain" : "cover",
                background: slide.objectFit === "contain" ? "#0a0a0a" : undefined,
              }}
            />

            {slide.badge && (
              <div
                style={{
                  position: "absolute",
                  top: 16,
                  right: 16,
                  background: slide.badgeBg ?? "rgba(0,0,0,0.55)",
                  backdropFilter: "blur(6px)",
                  WebkitBackdropFilter: "blur(6px)",
                  border: "1px solid rgba(255,255,255,0.18)",
                  borderRadius: 999,
                  padding: "4px 12px",
                  color: "rgba(255,255,255,0.9)",
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  lineHeight: 1.5,
                  pointerEvents: "none",
                  zIndex: 10,
                }}
              >
                {slide.badge}
              </div>
            )}

            <div className="carousel-overlay-centered" />

            <div className="carousel-text-centered">
              {slide.eyebrow && <div className="carousel-eyebrow-centered">{slide.eyebrow}</div>}
              <h3 className="carousel-title-centered">{slide.title}</h3>
            </div>

            <button
              className="carousel-plus-btn"
              onClick={(e) => openSheet(i, e.currentTarget)}
              aria-label={viewDetailsLabel}
            >
              <Plus size={24} strokeWidth={2.5} />
            </button>
          </div>
        ))}
        <div className="carousel-spacer" aria-hidden="true" />
      </div>

      <div className="carousel-pagination-centered">
        {slides.map((_, i) => (
          <button
            key={i}
            className={`carousel-dot-centered ${i === activeIndex ? "active" : ""}`}
            onClick={() => scrollToSlide(i)}
            role="tab"
            aria-selected={i === activeIndex}
            aria-label={`Go to slide ${i + 1}`}
          >
            {i === activeIndex && (
              <div
                className="carousel-dot-progress-centered"
                style={{
                  "--progress": shouldAutoplay
                    ? autoplayStateRef.current.elapsedMs / autoplayInterval
                    : 0,
                } as React.CSSProperties}
              />
            )}
          </button>
        ))}

        <button
          className="carousel-play-pause-centered"
          onClick={toggleAutoplay}
          aria-pressed={isPlaying}
          aria-label={isPlaying ? "Pause carousel" : "Play carousel"}
        >
          {isPlaying ? <Pause size={20} /> : <Play size={20} />}
        </button>
      </div>

      <AnimatePresence>
        {sheetOpen && currentSlide && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.25 }}
              onClick={closeSheet}
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0, 0, 0, 0.75)",
                zIndex: 9998,
              }}
            />

            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="sheet-title"
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.92 }}
              animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.92 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.4, ease: [0.2, 0.7, 0.3, 1] }}
              style={{
                position: "fixed",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                width: "min(90vw, 800px)",
                maxHeight: "85vh",
                background: currentSlide.darkTheme ? "#1a1a1a" : "#ffffff",
                borderRadius: 32,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                zIndex: 9999,
                border: currentSlide.darkTheme ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.08)",
              }}
            >
              <button
                onClick={closeSheet}
                aria-label={closeLabel}
                style={{
                  position: "absolute",
                  top: 16,
                  right: 16,
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  background: currentSlide.darkTheme ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.08)",
                  border: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: currentSlide.darkTheme ? "white" : "#111",
                  transition: "all 200ms ease",
                  zIndex: 10,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = currentSlide.darkTheme ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.15)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = currentSlide.darkTheme ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.08)";
                }}
              >
                <X size={24} />
              </button>

              <div style={{ overflowY: "auto", flex: 1 }}>
                <div style={{ position: "relative", width: "100%", aspectRatio: currentSlide.aspectRatio ?? aspectRatio }}>
                  <Image
                    src={currentSlide.src}
                    alt={currentSlide.alt || currentSlide.title}
                    fill
                    sizes="(max-width: 768px) 92vw, (max-width: 1440px) 1200px, (max-width: 2560px) 1600px, 2000px"
                    quality={90}
                    style={{
                      objectFit: currentSlide.objectFit === "contain" ? "contain" : "cover",
                      objectPosition: currentSlide.focus || "center",
                      background: currentSlide.objectFit === "contain" ? "#0a0a0a" : undefined,
                    }}
                  />
                  {currentSlide.badge && (
                    <div
                      style={{
                        position: "absolute",
                        top: 16,
                        right: 72,
                        background: currentSlide.badgeBg ?? "rgba(0,0,0,0.55)",
                        backdropFilter: "blur(6px)",
                        WebkitBackdropFilter: "blur(6px)",
                        border: "1px solid rgba(255,255,255,0.18)",
                        borderRadius: 999,
                        padding: "4px 12px",
                        color: "rgba(255,255,255,0.9)",
                        fontSize: 11,
                        fontWeight: 600,
                        letterSpacing: "0.08em",
                        lineHeight: 1.5,
                      }}
                    >
                      {currentSlide.badge}
                    </div>
                  )}
                </div>

                <div style={{ padding: "32px 32px 48px", color: currentSlide.darkTheme ? "#f5f5f7" : "#111" }}>
                  {currentSlide.eyebrow && (
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        letterSpacing: "0.16em",
                        textTransform: "uppercase",
                        color: currentSlide.darkTheme ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)",
                        marginBottom: 12,
                      }}
                    >
                      {currentSlide.eyebrow}
                    </div>
                  )}
                  <h2
                    id="sheet-title"
                    style={{
                      fontSize: "clamp(28px, 5vw, 40px)",
                      fontWeight: 600,
                      lineHeight: 1.1,
                      letterSpacing: "-0.02em",
                      marginBottom: 24,
                    }}
                  >
                    {currentSlide.title}
                  </h2>
                  <div
                    style={{
                      fontSize: "clamp(16px, 2.5vw, 18px)",
                      lineHeight: 1.6,
                      color: currentSlide.darkTheme ? "rgba(255,255,255,0.75)" : "rgba(0,0,0,0.7)",
                    }}
                  >
                    {parseBoldText(currentSlide.detailedDesc || currentSlide.desc || "", currentSlide.darkTheme || false)}
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
