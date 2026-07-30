"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import Image from "next/image";

const FONT_FAMILY =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Noto Sans TC', 'Helvetica Neue', Helvetica, Arial, sans-serif";

const EASE = [0.2, 0.7, 0.3, 1] as const;

// Real media assets mapped per item (see README for provenance)
// Item 1: looping video — professional table
// Items 2-4: static photos — door/entry, Infinity room, competition lighting
const mediaItems = [
  { type: "video" as const, src: "/gallery/table-loop.mp4" },
  { type: "image" as const, src: "/gallery/Space8_Door.PNG" },
  { type: "image" as const, src: "/gallery/Space_Infinity.PNG" },
  { type: "image" as const, src: "/gallery/Space8_Competition_Mode.PNG" },
];

// Static images for mobile (stacked layout uses images only — video poster for item 1)
const slideImages = [
  "/gallery/table-poster.jpg",
  "/gallery/Space8_Door.PNG",
  "/gallery/Space_Infinity.PNG",
  "/gallery/Space8_Competition_Mode.PNG",
];

export default function GalleryScroll() {
  const t = useTranslations("gallery");
  const slideTexts = t.raw("slides") as {
    title: string;
    subtitle: string;
    alt: string;
  }[];
  const slides = slideImages.map((image, i) => ({
    image,
    title: slideTexts[i]?.title ?? "",
    subtitle: slideTexts[i]?.subtitle ?? "",
    alt: slideTexts[i]?.alt ?? "",
  }));

  const [activeIndex, setActiveIndex] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [isIn, setIsIn] = useState(false);
  const [revealedBeats, setRevealedBeats] = useState<boolean[]>(
    new Array(slideImages.length).fill(false),
  );
  const itemsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const secRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const beatRefs = useRef<(HTMLDivElement | null)[]>([]);
  const stageRef = useRef<HTMLDivElement>(null);
  const stepsRef = useRef<HTMLDivElement>(null);
  const imgsRef = useRef<(HTMLImageElement | null)[]>([]);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // ── Section-level entrance: pop in all 4 items once ──
  useEffect(() => {
    const el = secRef.current;
    if (!el) return;
    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      !("IntersectionObserver" in window)
    ) {
      setIsIn(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          setIsIn(true);
          obs.unobserve(e.target);
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // ── Mobile: sequential beat reveal via IntersectionObserver ──
  useEffect(() => {
    if (!isMobile) return;
    const beatEls = beatRefs.current.filter(Boolean);
    if (!beatEls.length) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const idx = beatEls.indexOf(entry.target as HTMLDivElement);
          if (idx === -1) return;
          setRevealedBeats((prev) => {
            const next = [...prev];
            if (!next[idx]) {
              next[idx] = true;
            }
            return next;
          });
          obs.unobserve(entry.target);
        });
      },
      { threshold: 0.2, rootMargin: "0px 0px -8% 0px" },
    );
    beatEls.forEach((el) => {
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, [isMobile]);

  // ── Desktop: scroll-driven reveal (matches reference HTML exactly) ──
  useEffect(() => {
    if (isMobile) return;
    const stage = stageRef.current;
    const stepsEl = stepsRef.current;
    if (!stage || !stepsEl) return;

    const steps = Array.from(stepsEl.querySelectorAll<HTMLElement>(".jr-step"));
    const imgs = Array.from(document.querySelectorAll<HTMLElement>(".jr-img"));
    const n = steps.length;
    if (!n) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let current = -1;
    let revealedTo = -1;
    const STEP_VH = 0.55;
    let ticking = false;

    function setActive(i: number) {
      i = Math.max(0, Math.min(n - 1, i));
      if (i === current) return;
      current = i;
      setActiveIndex(i);
      steps.forEach((s, k) => {
        s.classList.toggle("is-active", k === i);
        s.classList.toggle("is-done", k < i);
      });
      imgs.forEach((im, k) => {
        im.classList.toggle("is-on", k === i);
      });
    }

    function isPinned() {
      return !reduce && window.matchMedia("(min-width: 861px)").matches;
    }

    function sizeStage() {
      const s = stageRef.current;
      if (!s) return;
      if (!isPinned()) {
        s.style.height = "auto";
        return;
      }
      const vh = window.innerHeight;
      s.style.height = Math.round(vh * (1 + (n - 1) * STEP_VH + 0.35)) + "px";
    }

    function revealTo(i: number) {
      if (i > revealedTo) {
        for (let k = revealedTo + 1; k <= i; k++) {
          steps[k]?.classList.add("is-shown");
        }
        revealedTo = i;
      }
      setActive(i);
    }

    function update() {
      ticking = false;
      if (reduce) return;

      if (!isPinned()) {
        const scrolledM = Math.max(0, (window.pageYOffset || 0) - stage!.offsetTop);
        const gapM = Math.max(110, Math.round(stage!.offsetHeight * 0.5 / n));
        revealTo(Math.min(n - 1, Math.floor(scrolledM / gapM)));
        return;
      }

      const vh = window.innerHeight;
      const rect = stage!.getBoundingClientRect();
      const total = stage!.offsetHeight - vh;
      if (total <= 0) return;

      const scrolled = Math.max(0, Math.min(total, -rect.top));
      const p = scrolled / total;
      const usable = (n - 1) * STEP_VH;
      const pAdj = Math.min(1, p * (usable + 0.35) / usable);
      const i = Math.min(n - 1, Math.floor(pAdj * n));
      revealTo(i);
    }

    function onScroll() {
      if (!ticking) {
        window.requestAnimationFrame(update);
        ticking = true;
      }
    }

    // Click a step
    steps.forEach((s, k) => {
      s.addEventListener("click", () => revealTo(k));
    });

    if (reduce) {
      steps.forEach((s) => s.classList.add("is-shown"));
      setActive(0);
      return;
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", () => {
      sizeStage();
      onScroll();
    });

    sizeStage();
    update();

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", sizeStage);
    };
  }, [isMobile]);

  // ── Play/pause video when activeIndex changes ──
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (activeIndex === 0) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [activeIndex]);

  const sectionTitle = t("title");

  // ── Mobile beat: image + numbered badge + title + description ──
  // Each beat occupies ~full viewport height — large image dominates, text below.
  const renderMobileBeat = (slide: (typeof slides)[number], i: number) => {
    const revealed = revealedBeats[i];
    return (
      <div
        key={slide.title}
        ref={(el) => {
          beatRefs.current[i] = el;
        }}
        className="gs-mobile-beat"
        style={{
          opacity: revealed ? 1 : 0,
          transform: revealed ? "translateY(0)" : "translateY(24px)",
          transition: `opacity 0.6s cubic-bezier(${EASE[0]},${EASE[1]},${EASE[2]},${EASE[3]}), transform 0.6s cubic-bezier(${EASE[0]},${EASE[1]},${EASE[2]},${EASE[3]})`,
          transitionDelay: `${i * 0.08}s`,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        {/* Image — large, dominant, ~65vh minimum */}
        <div
          style={{
            position: "relative",
            width: "100%",
            minHeight: "65vh",
            borderRadius: 20,
            overflow: "hidden",
            background: "#0b0b0d",
            border: "1px solid rgba(245,242,236,0.13)",
          }}
        >
          <Image
            src={slide.image}
            alt={slide.alt}
            fill
            sizes="100vw"
            style={{ objectFit: "cover" }}
          />
        </div>
        {/* Text below image */}
        <div style={{ paddingTop: 24 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 8,
            }}
          >
            <span
              style={{
                flexShrink: 0,
                width: 36,
                height: 36,
                borderRadius: "50%",
                border: "1px solid rgba(34,197,94,0.5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 13,
                fontWeight: 600,
                color: "#22C55E",
                background: "rgba(34,197,94,0.1)",
              }}
            >
              {i + 1}
            </span>
            <h3
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: "white",
                margin: 0,
                lineHeight: 1.3,
              }}
            >
              {slide.title}
            </h3>
          </div>
          <p
            style={{
              fontSize: 15,
              lineHeight: 1.7,
              color: "rgba(245,242,236,0.6)",
              margin: 0,
              paddingLeft: 48,
            }}
          >
            {slide.subtitle}
          </p>
        </div>
      </div>
    );
  };

  return (
    <section
      ref={secRef}
      className={`gs-section ${isIn ? "is-in" : ""}`}
      data-nav-theme="dark"
      style={{
        background: "#1C1C1E",
        fontFamily: FONT_FAMILY,
        padding: isMobile ? "0 0 100px" : 0,
      }}
    >
      {isMobile ? (
        /* ── Mobile: Apple-style sequential beats (no sticky, no overlap) ── */
        <div>
          {/* Beat 0: text-only heading — full-screen standalone beat */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: "100vh",
              padding: "0 24px",
            }}
          >
            <h2
              data-cms-key="gallery.title"
              style={{
                fontWeight: 700,
                fontSize: "clamp(36px, 8vw, 52px)",
                letterSpacing: "-0.025em",
                color: "white",
                textAlign: "center",
                margin: 0,
                lineHeight: 1.2,
              }}
            >
              {sectionTitle}
            </h2>
          </div>

          {/* Beats 1-4: image + text, stacked vertically in normal flow */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 80,
              padding: "0 24px 0",
            }}
          >
            {slides.map((slide, i) => renderMobileBeat(slide, i))}
          </div>
        </div>
      ) : (
        /* ── Desktop: jr-stage scroll-pinned layout (matches reference HTML exactly) ── */
        <div ref={stageRef} className="jr-stage" style={{ position: "relative" }}>
          <div className="jr-sticky">
            <div className="venue-inner">
              {/* Heading — INSIDE venue-inner, ABOVE jr-layout, with margin-bottom separating it */}
              <h2
                data-cms-key="gallery.title"
                className="venue-title"
              >
                {sectionTitle}
              </h2>

              <div className="jr-layout">
                {/* Left: steps */}
                <div ref={stepsRef} className="jr-steps">
                  {slides.map((slide, i) => (
                    <button
                      key={slide.title}
                      ref={(el) => {
                        itemsRef.current[i] = el;
                      }}
                      data-i={i}
                      type="button"
                      className="jr-step"
                    >
                      <span className="jr-marker">
                        <span className="jr-num">{i + 1}</span>
                        <svg className="jr-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                          <path d="m5 12.5 4.5 4.5L19 7.5" />
                        </svg>
                      </span>
                      <span className="jr-text">
                        <span className="jr-h">{slide.title}</span>
                        <span className="jr-p">{slide.subtitle}</span>
                      </span>
                    </button>
                  ))}
                </div>

                {/* Right: visual — stacked images crossfade, video overlay for item 1 */}
                <div className="jr-visual">
                  {/* Video overlay — only shows when activeIndex === 0 */}
                  <video
                    ref={videoRef}
                    src={mediaItems[0].src}
                    muted
                    loop
                    playsInline
                    autoPlay
                    preload="auto"
                    poster="/gallery/table-poster.jpg"
                    className="jr-img"
                    style={{
                      objectFit: "cover",
                      zIndex: activeIndex === 0 ? 3 : 0,
                    }}
                  />
                  {/* 4 stacked images — crossfade via .is-on class */}
                  {slides.map((slide, i) => (
                    <Image
                      key={slide.image}
                      src={slide.image}
                      alt={slide.alt}
                      fill
                      sizes="(max-width: 768px) 100vw, 50vw"
                      priority={i === 0}
                      className={`jr-img ${i === activeIndex ? "is-on" : ""}`}
                      ref={(el) => {
                        imgsRef.current[i] = el;
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .jr-stage {
          position: relative;
        }
        .jr-sticky {
          position: sticky;
          top: 0;
          height: 100vh;
          display: flex;
          align-items: center;
          padding: 40px 24px;
          overflow: hidden;
        }
        .venue-inner {
          max-width: 1080px;
          margin: 0 auto;
          width: 100%;
        }
        .venue-title {
          font-family: 'Noto Sans TC', sans-serif;
          font-weight: 900;
          font-size: clamp(1.7rem, 3.6vw, 2.5rem);
          color: #f5f2ec;
          text-align: center;
          margin-bottom: 34px;
        }
        .jr-layout {
          display: grid;
          grid-template-columns: 1fr 1.05fr;
          gap: 44px;
          align-items: center;
        }
        .jr-steps {
          display: flex;
          flex-direction: column;
          gap: 30px;
        }
        .jr-step {
          display: flex;
          gap: 20px;
          align-items: flex-start;
          text-align: left;
          background: none;
          border: 0;
          opacity: 0;
          transform: translateY(16px);
          transition: opacity .6s cubic-bezier(.2,.7,.3,1),
                      transform .6s cubic-bezier(.2,.7,.3,1);
          padding: 0;
          cursor: pointer;
          font: inherit;
          color: inherit;
        }
        .jr-step.is-shown {
          opacity: 1;
          transform: none;
        }
        .jr-marker {
          position: relative;
          flex-shrink: 0;
          width: 42px; height: 42px;
          border-radius: 50%;
          border: 1px solid rgba(245,242,236,0.13);
          display: flex; align-items: center; justify-content: center;
          color: rgba(245,242,236,0.28);
          transition: background .45s ease, border-color .45s ease, color .45s ease, transform .45s cubic-bezier(.2,.7,.3,1);
          margin-top: 2px;
        }
        .jr-num {
          font-family: 'Inter', sans-serif;
          font-size: 14px; font-weight: 500;
          transition: opacity .3s ease;
        }
        .jr-check {
          position: absolute;
          width: 19px; height: 19px;
          opacity: 0;
          transition: opacity .3s ease;
        }
        .jr-text { display: block; }
        .jr-h {
          display: block;
          font-family: 'Noto Sans TC', sans-serif;
          font-weight: 700;
          font-size: clamp(17px, 2vw, 20px);
          color: rgba(245,242,236,0.28);
          margin-bottom: 8px;
          transition: color .45s ease, transform .55s cubic-bezier(.2,.7,.3,1);
        }
        .jr-p {
          display: block;
          font-family: 'Noto Sans TC', sans-serif;
          font-size: 14.5px;
          line-height: 1.8;
          color: rgba(245,242,236,0.28);
          max-width: 34ch;
          transition: color .45s ease, transform .55s cubic-bezier(.2,.7,.3,1);
        }

        .jr-step.is-done .jr-marker {
          border-color: rgba(34,184,107,0.5);
          color: #22b86b;
        }
        .jr-step.is-done .jr-num { opacity: 0; }
        .jr-step.is-done .jr-check { opacity: 1; }

        .jr-step.is-active .jr-marker {
          background: #1a9d5c;
          border-color: #1a9d5c;
          color: #ffffff;
          transform: scale(1.06);
        }
        .jr-step.is-active .jr-num { opacity: 0; }
        .jr-step.is-active .jr-check { opacity: 1; }
        .jr-step.is-active .jr-h { color: #ffffff; transform: translateX(3px); }
        .jr-step.is-active .jr-p { color: rgba(245,242,236,0.60); transform: translateX(3px); }

        .jr-visual {
          position: relative;
          border-radius: 18px;
          overflow: hidden;
          border: 1px solid rgba(245,242,236,0.13);
          background: #0b0b0d;
          aspect-ratio: 4 / 3;
        }
        .jr-img {
          position: absolute; inset: 0;
          width: 100%; height: 100%;
          object-fit: cover;
          display: block;
          opacity: 0;
          transform: scale(1.05);
          transition: opacity .75s ease, transform 1.2s cubic-bezier(.2,.7,.3,1);
        }
        .jr-img.is-on { opacity: 1; transform: scale(1); }

        @media (max-width: 861px) {
          .jr-layout { grid-template-columns: 1fr; gap: 30px; }
          .jr-visual { order: -1; }
          .jr-steps { gap: 24px; }
          .venue-title { margin-bottom: 34px; }
          .jr-stage { height: auto !important; }
          .jr-sticky { position: relative; height: auto; padding: 80px 20px 90px; overflow: visible; }
        }
        @media (max-width: 560px) {
          .jr-marker { width: 36px; height: 36px; }
          .jr-step { gap: 15px; }
          .jr-p { font-size: 13.5px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .jr-stage { height: auto !important; }
          .jr-sticky { position: relative; height: auto; padding: 90px 24px 100px; min-height: 0; }
          .jr-img { transition: none; }
          .jr-h, .jr-p, .jr-marker { transition: none; }
          .jr-step { opacity: 1 !important; transform: none !important; }
        }
        .gs-mobile-beat { will-change: opacity, transform; }
      `}</style>
    </section>
  );
}