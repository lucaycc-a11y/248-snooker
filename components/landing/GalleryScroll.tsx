"use client";

import { useEffect, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import Image from "next/image";

const FONT_FAMILY =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Noto Sans TC', 'Helvetica Neue', Helvetica, Arial, sans-serif";

const slideImages = [
  "/gallery/IMG_1511.jpg",
  "/gallery/IMG_1513.jpg",
  "/gallery/IMG_1514.jpg",
  "/gallery/IMG_1515.jpg",
];

export default function GalleryScroll() {
  const t = useTranslations("gallery");
  const slideTexts = t.raw("slides") as { title: string; subtitle: string; alt: string }[];
  const slides = slideImages.map((image, i) => ({
    image,
    title: slideTexts[i]?.title ?? "",
    subtitle: slideTexts[i]?.subtitle ?? "",
    alt: slideTexts[i]?.alt ?? "",
  }));

  const stageRef = useRef<HTMLDivElement>(null);
  const stepsRef = useRef<HTMLDivElement>(null);
  const currentRef = useRef(-1);
  const revealedRef = useRef(-1);
  const rafRef = useRef(0);

  const n = slides.length;
  const STEP_VH = 0.55;

  const isPinned = useCallback(() => {
    if (typeof window === "undefined") return false;
    return !window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
           window.matchMedia("(min-width: 861px)").matches;
  }, []);

  const setActive = useCallback((i: number) => {
    const idx = Math.max(0, Math.min(n - 1, i));
    if (idx === currentRef.current) return;
    currentRef.current = idx;
    const steps = stepsRef.current;
    if (!steps) return;
    const buttons = steps.querySelectorAll<HTMLButtonElement>(".jr-step");
    const imgs = document.querySelectorAll<HTMLImageElement>(".jr-img");
    buttons.forEach((btn, k) => {
      btn.classList.toggle("is-active", k === idx);
      btn.classList.toggle("is-done", k < idx);
    });
    imgs.forEach((img, k) => {
      img.classList.toggle("is-on", k === idx);
    });
  }, [n]);

  const revealTo = useCallback((i: number) => {
    const steps = stepsRef.current;
    if (!steps) return;
    const buttons = steps.querySelectorAll<HTMLButtonElement>(".jr-step");
    if (i > revealedRef.current) {
      for (let k = revealedRef.current + 1; k <= i; k++) {
        buttons[k]?.classList.add("is-shown");
      }
      revealedRef.current = i;
    }
    setActive(i);
  }, [setActive]);

  useEffect(() => {
    const stage = stageRef.current;
    const steps = stepsRef.current;
    if (!stage || !steps) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const sizeStage = () => {
      if (!isPinned()) { stage.style.height = "auto"; return; }
      const vh = window.innerHeight;
      stage.style.height = Math.round(vh * (1 + (n - 1) * STEP_VH + 0.35)) + "px";
    };

    let ticking = false;
    const update = () => {
      ticking = false;
      if (reduce) return;

      if (!isPinned()) {
        const scrolledM = Math.max(0, (window.pageYOffset || 0) - stage.offsetTop);
        const gapM = Math.max(110, Math.round(stage.offsetHeight * 0.5 / n));
        revealTo(Math.min(n - 1, Math.floor(scrolledM / gapM)));
        return;
      }

      const vh = window.innerHeight;
      const rect = stage.getBoundingClientRect();
      const total = stage.offsetHeight - vh;
      if (total <= 0) return;

      const scrolled = Math.max(0, Math.min(total, -rect.top));
      const p = scrolled / total;
      const usable = (n - 1) * STEP_VH;
      const pAdj = Math.min(1, p * (usable + 0.35) / usable);
      const i = Math.min(n - 1, Math.floor(pAdj * n));
      revealTo(i);
    };

    const onScroll = () => {
      if (!ticking) { rafRef.current = window.requestAnimationFrame(update); ticking = true; }
    };

    // Click steps
    const buttons = steps.querySelectorAll<HTMLButtonElement>(".jr-step");
    buttons.forEach((btn, k) => {
      btn.addEventListener("click", () => revealTo(k));
    });

    if (reduce) {
      buttons.forEach((btn) => btn.classList.add("is-shown"));
      setActive(0);
      sizeStage();
      return;
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", () => { sizeStage(); update(); });
    window.addEventListener("load", () => { sizeStage(); update(); });

    sizeStage();
    update();

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", sizeStage);
      window.removeEventListener("load", sizeStage);
      cancelAnimationFrame(rafRef.current);
    };
  }, [n, isPinned, revealTo, setActive]);

  return (
    <section
      id="gallery-scroll"
      data-nav-theme="dark"
      style={{
        background: "#1c1c1e",
        color: "#f5f2ec",
        fontFamily: FONT_FAMILY,
      }}
    >
      <div className="jr-stage" ref={stageRef} style={{ position: "relative" }}>
        <div className="jr-sticky" style={{
          position: "sticky",
          top: 0,
          height: "100vh",
          display: "flex",
          alignItems: "center",
          padding: "40px 24px",
          overflow: "hidden",
        }}>
          <div className="venue-inner" style={{ maxWidth: 1080, margin: "0 auto", width: "100%" }}>
            <h2 className="venue-title" style={{
              fontFamily: FONT_FAMILY,
              fontWeight: 900,
              fontSize: "clamp(1.7rem, 3.6vw, 2.5rem)",
              color: "#f5f2ec",
              textAlign: "center",
              marginBottom: 34,
            }}>
              {t("title")}
            </h2>

            <div className="jr-layout" style={{
              display: "grid",
              gridTemplateColumns: "1fr 1.05fr",
              gap: 44,
              alignItems: "center",
            }}>
              {/* Left: steps */}
              <div className="jr-steps" ref={stepsRef} style={{ display: "flex", flexDirection: "column", gap: 30 }}>
                {slides.map((slide, i) => (
                  <button
                    key={slide.title}
                    className="jr-step"
                    data-i={i}
                    type="button"
                    style={{
                      display: "flex",
                      gap: 20,
                      alignItems: "flex-start",
                      textAlign: "left",
                      background: "none",
                      border: 0,
                      opacity: 0,
                      transform: "translateY(16px)",
                      transition: "opacity .6s cubic-bezier(.2,.7,.3,1), transform .6s cubic-bezier(.2,.7,.3,1)",
                      padding: 0,
                      cursor: "pointer",
                      font: "inherit",
                      color: "inherit",
                    }}
                  >
                    <span className="jr-marker" style={{
                      position: "relative",
                      flexShrink: 0,
                      width: 42,
                      height: 42,
                      borderRadius: "50%",
                      border: "1px solid rgba(245,242,236,0.13)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "rgba(245,242,236,0.28)",
                      transition: "background .45s ease, border-color .45s ease, color .45s ease, transform .45s cubic-bezier(.2,.7,.3,1)",
                      marginTop: 2,
                    }}>
                      <span className="jr-num" style={{
                        fontFamily: FONT_FAMILY,
                        fontSize: 14,
                        fontWeight: 500,
                        transition: "opacity .3s ease",
                      }}>
                        {i + 1}
                      </span>
                      <svg className="jr-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{
                        position: "absolute",
                        width: 19,
                        height: 19,
                        opacity: 0,
                        transition: "opacity .3s ease",
                      }}>
                        <path d="m5 12.5 4.5 4.5L19 7.5" />
                      </svg>
                    </span>
                    <span className="jr-text" style={{ display: "block" }}>
                      <span className="jr-h" style={{
                        display: "block",
                        fontFamily: FONT_FAMILY,
                        fontWeight: 700,
                        fontSize: "clamp(17px, 2vw, 20px)",
                        color: "rgba(245,242,236,0.28)",
                        marginBottom: 8,
                        transition: "color .45s ease, transform .55s cubic-bezier(.2,.7,.3,1)",
                      }}>
                        {slide.title}
                      </span>
                      <span className="jr-p" style={{
                        display: "block",
                        fontFamily: FONT_FAMILY,
                        fontSize: 14.5,
                        lineHeight: 1.8,
                        color: "rgba(245,242,236,0.28)",
                        maxWidth: "34ch",
                        transition: "color .45s ease, transform .55s cubic-bezier(.2,.7,.3,1)",
                      }}>
                        {slide.subtitle}
                      </span>
                    </span>
                  </button>
                ))}
              </div>

              {/* Right: image */}
              <div className="jr-visual" style={{
                position: "relative",
                borderRadius: 18,
                overflow: "hidden",
                border: "1px solid rgba(245,242,236,0.13)",
                background: "#0b0b0d",
                aspectRatio: "4 / 3",
              }}>
                {slides.map((slide, i) => (
                  <Image
                    key={slide.title}
                    className={`jr-img ${i === 0 ? "is-on" : ""}`}
                    data-i={i}
                    src={slide.image}
                    alt={slide.alt}
                    fill
                    sizes="(max-width: 860px) 100vw, 50vw"
                    style={{
                      objectFit: "cover",
                      opacity: i === 0 ? 1 : 0,
                      transform: i === 0 ? "scale(1)" : "scale(1.05)",
                      transition: "opacity .75s ease, transform 1.2s cubic-bezier(.2,.7,.3,1)",
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 860px) {
          .jr-layout { grid-template-columns: 1fr; gap: 30px; }
          .jr-visual { order: -1; }
          .jr-steps { gap: 24px; }
          .jr-stage { height: auto !important; }
          .jr-sticky { position: relative; height: auto; padding: 80px 20px 90px; overflow: visible; }
        }
        @media (max-width: 560px) {
          .jr-marker { width: 36px !important; height: 36px !important; }
          .jr-step { gap: 15px; }
          .jr-p { font-size: 13.5px !important; }
        }
        .jr-step.is-shown { opacity: 1 !important; transform: none !important; }
        .jr-step.is-done .jr-marker { border-color: rgba(34,184,107,0.5) !important; color: #22b86b !important; }
        .jr-step.is-done .jr-num { opacity: 0 !important; }
        .jr-step.is-done .jr-check { opacity: 1 !important; }
        .jr-step.is-active .jr-marker { background: #1a9d5c !important; border-color: #1a9d5c !important; color: #fff !important; transform: scale(1.06) !important; }
        .jr-step.is-active .jr-num { opacity: 0 !important; }
        .jr-step.is-active .jr-check { opacity: 1 !important; }
        .jr-step.is-active .jr-h { color: #fff !important; transform: translateX(3px) !important; }
        .jr-step.is-active .jr-p { color: rgba(245,242,236,0.60) !important; transform: translateX(3px) !important; }
        @media (prefers-reduced-motion: reduce) {
          .jr-stage { height: auto !important; }
          .jr-sticky { position: relative; height: auto; padding: 90px 24px 100px; }
          .jr-img { transition: none !important; }
          .jr-h, .jr-p, .jr-marker { transition: none !important; }
          .jr-step { opacity: 1 !important; transform: none !important; }
        }
      `}</style>
    </section>
  );
}