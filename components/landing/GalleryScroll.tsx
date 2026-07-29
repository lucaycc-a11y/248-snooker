"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import Image from "next/image";

const FONT_FAMILY =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Noto Sans TC', 'Helvetica Neue', Helvetica, Arial, sans-serif";

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
  const itemsRef = useRef<(HTMLDivElement | null)[]>([]);
  const secRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

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

  // ── Desktop: IntersectionObserver for scroll-synced media swap ──
  useEffect(() => {
    if (isMobile) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Pick the entry whose intersection rect is closest to viewport centre
        let bestIdx = -1;
        let bestDist = Infinity;
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const idx = Number(entry.target.getAttribute("data-index"));
          const rect = entry.boundingClientRect;
          const centre = rect.top + rect.height / 2;
          const vh = window.innerHeight;
          const dist = Math.abs(centre - vh / 2);
          if (dist < bestDist) {
            bestDist = dist;
            bestIdx = idx;
          }
        });
        if (bestIdx >= 0) setActiveIndex(bestIdx);
      },
      { threshold: 0.3, rootMargin: "-35% 0px -35% 0px" },
    );

    const current = itemsRef.current;
    current.forEach((el) => {
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [isMobile]);

  // ── Play/pause video when activeIndex changes ──
  // Video only plays while item 0 (professional table) is active;
  // paused when user scrolls past to items 1-3.
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

  return (
    <section
      ref={secRef}
      className={`gs-section ${isIn ? "is-in" : ""}`}
      data-nav-theme="dark"
      style={{
        background: "#1C1C1E",
        fontFamily: FONT_FAMILY,
        padding: isMobile ? "88px 0 100px" : "140px 0 60vh",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px" }}>
        {/* ── Section title ── */}
        <h2
          data-cms-key="gallery.title"
          style={{
            fontWeight: 700,
            fontSize: "clamp(32px, 4vw, 48px)",
            letterSpacing: "-0.025em",
            color: "white",
            textAlign: "center",
            margin: "0 0 56px",
          }}
        >
          {sectionTitle}
        </h2>

        {isMobile ? (
          /* ── Mobile: stacked items, each with its own inline image ── */
          <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
            {slides.map((slide, i) => (
              <div
                key={slide.title}
                className="gs-item"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                  opacity: 0,
                  transform: "translateY(16px) scale(0.97)",
                  transition: "opacity .5s cubic-bezier(.34,1.56,.64,1), transform .5s cubic-bezier(.34,1.56,.64,1)",
                }}
              >
                {/* Text row */}
                <div
                  style={{
                    display: "flex",
                    gap: 16,
                    alignItems: "flex-start",
                  }}
                >
                  <span
                    style={{
                      flexShrink: 0,
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      border: "1px solid rgba(245,242,236,0.2)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 14,
                      fontWeight: 500,
                      color: "rgba(245,242,236,0.5)",
                      marginTop: 1,
                    }}
                  >
                    {i + 1}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3
                      style={{
                        fontSize: 18,
                        fontWeight: 700,
                        color: "white",
                        margin: "0 0 6px",
                        lineHeight: 1.3,
                      }}
                    >
                      {slide.title}
                    </h3>
                    <p
                      style={{
                        fontSize: 14.5,
                        lineHeight: 1.7,
                        color: "rgba(245,242,236,0.6)",
                        margin: 0,
                      }}
                    >
                      {slide.subtitle}
                    </p>
                  </div>
                </div>
                {/* Inline image */}
                <div
                  style={{
                    position: "relative",
                    width: "100%",
                    aspectRatio: "4 / 3",
                    borderRadius: 18,
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
              </div>
            ))}
          </div>
        ) : (
          /* ── Desktop: 2-column grid, pinned media, scroll-synced swap ── */
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 44,
              alignItems: "start",
            }}
          >
            {/* Left: all 4 text items, visible at once */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 40,
              }}
            >
              {slides.map((slide, i) => (
                <div
                  key={slide.title}
                  ref={(el) => {
                    itemsRef.current[i] = el;
                  }}
                  data-index={i}
                  onClick={() => setActiveIndex(i)}
                  className="gs-item"
                  style={{
                    display: "flex",
                    gap: 20,
                    alignItems: "flex-start",
                    cursor: "pointer",
                    opacity: 0,
                    transform: "translateY(20px) scale(0.95)",
                    transition: "opacity .5s cubic-bezier(.34,1.56,.64,1), transform .5s cubic-bezier(.34,1.56,.64,1)",
                  }}
                >
                  {/* Numbered marker */}
                  <span
                    style={{
                      flexShrink: 0,
                      width: 42,
                      height: 42,
                      borderRadius: "50%",
                      border: `1px solid ${
                        i === activeIndex
                          ? "rgba(34,197,94,0.5)"
                          : "rgba(245,242,236,0.13)"
                      }`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 14,
                      fontWeight: 500,
                      color:
                        i === activeIndex
                          ? "#22C55E"
                          : "rgba(245,242,236,0.28)",
                      background:
                        i === activeIndex
                          ? "rgba(34,197,94,0.1)"
                          : "transparent",
                      transition:
                        "all 0.4s cubic-bezier(0.16,1,0.3,1)",
                      marginTop: 2,
                    }}
                  >
                    {i + 1}
                  </span>

                  {/* Text content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3
                      style={{
                        fontSize: "clamp(17px, 2vw, 20px)",
                        fontWeight: 700,
                        color:
                          i === activeIndex
                            ? "white"
                            : "rgba(245,242,236,0.28)",
                        margin: "0 0 8px",
                        lineHeight: 1.3,
                        transition:
                          "color 0.4s cubic-bezier(0.16,1,0.3,1)",
                      }}
                    >
                      {slide.title}
                    </h3>
                    <p
                      style={{
                        fontSize: 14.5,
                        lineHeight: 1.8,
                        color:
                          i === activeIndex
                            ? "rgba(245,242,236,0.6)"
                            : "rgba(245,242,236,0.28)",
                        margin: 0,
                        maxWidth: "34ch",
                        transition:
                          "color 0.4s cubic-bezier(0.16,1,0.3,1)",
                      }}
                    >
                      {slide.subtitle}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Right: sticky pinned media with crossfade (video for item 1, images for 2-4) */}
            <div
              style={{
                position: "sticky",
                top: "50%",
                transform: "translateY(-50%)",
                alignSelf: "start",
                borderRadius: 18,
                overflow: "hidden",
                border: "1px solid rgba(245,242,236,0.13)",
                background: "#0b0b0d",
                aspectRatio: "4 / 3",
              }}
            >
              {/* Video element — always mounted, shown/hidden via opacity */}
              <video
                ref={videoRef}
                src={mediaItems[0].src}
                muted
                loop
                playsInline
                preload="auto"
                poster="/gallery/table-poster.jpg"
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  opacity: activeIndex === 0 ? 1 : 0,
                  transition: "opacity 0.22s ease",
                  zIndex: activeIndex === 0 ? 2 : 0,
                }}
              />
              {/* Image elements — one per image item, crossfade via opacity */}
              {mediaItems.slice(1).map((m) => {
                const origIndex = mediaItems.findIndex(
                  (mi) => mi.src === m.src,
                );
                return (
                  <Image
                    key={m.src}
                    src={m.src}
                    alt={slides[origIndex]?.alt ?? ""}
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    priority={origIndex === 1}
                    style={{
                      objectFit: "cover",
                      opacity: activeIndex === origIndex ? 1 : 0,
                      transition: "opacity 0.22s ease",
                      zIndex: activeIndex === origIndex ? 2 : 0,
                    }}
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>

      <style>{`
        .gs-section.is-in .gs-item { opacity: 1 !important; transform: none !important; }
        .gs-section.is-in .gs-item:nth-child(1) { transition-delay: .04s; }
        .gs-section.is-in .gs-item:nth-child(2) { transition-delay: .12s; }
        .gs-section.is-in .gs-item:nth-child(3) { transition-delay: .20s; }
        .gs-section.is-in .gs-item:nth-child(4) { transition-delay: .28s; }
        @media (prefers-reduced-motion: reduce) {
          .gs-item { opacity: 1 !important; transform: none !important; }
        }
      `}</style>
    </section>
  );
}