"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Play, Pause } from "lucide-react";

/** Slide metadata — data-driven carousel */
type Slide = {
  eyebrow?: string;
  title: string;
  desc?: string;
  src: string;
  alt?: string;
  altCmsKey?: string; // for CMS sync on alt text
  focus?: "center" | "center top" | "center bottom";
  width?: number; // image dimensions for next/image
  height?: number;
};

type AppleCarouselProps = {
  slides: Slide[];
  autoplayInterval?: number; // ms, default 5000
  aspectRatio?: string; // CSS aspect-ratio, default "3 / 4.1"
  onIndexChange?: (index: number) => void;
};

/**
 * Apple-style carousel: parallax text, auto-generated dots with progress bars,
 * smart autoplay (pauses on hover/tab-hidden/out-of-viewport), video auto-play/pause.
 */
export function AppleCarousel({
  slides,
  autoplayInterval = 5000,
  aspectRatio = "3 / 4.1",
  onIndexChange,
}: AppleCarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>();
  const videoRefsMap = useRef<Map<number, HTMLVideoElement>>(new Map());

  const [activeIndex, setActiveIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [isInViewport, setIsInViewport] = useState(true);
  const [parallaxData, setParallaxData] = useState<
    Array<{ p: number; abs: number; progress: number }>
  >(slides.map(() => ({ p: 0, abs: 0, progress: 0 })));

  // Prefers-reduced-motion check
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(query.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    query.addEventListener("change", handler);
    return () => query.removeEventListener("change", handler);
  }, []);

  // Autoplay state: track elapsed time (supports pause/resume)
  const autoplayStateRef = useRef({ elapsedMs: 0, lastFrameTime: 0 });

  // Pause autoplay if: hover, touch, tab hidden, out of viewport, user clicked pause
  const shouldAutoplay = isPlaying && !isPaused && isInViewport && !document.hidden;

  // Update active index based on scroll position (snap to center)
  const updateActiveIndex = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;

    const trackCenterX = track.scrollLeft + track.clientWidth / 2;
    let closest = 0;
    let minDist = Infinity;

    Array.from(track.children).forEach((child, i) => {
      const el = child as HTMLElement;
      const childCenter = el.offsetLeft + el.offsetWidth / 2;
      const dist = Math.abs(trackCenterX - childCenter);
      if (dist < minDist) {
        minDist = dist;
        closest = i;
      }
    });

    if (closest !== activeIndex) {
      setActiveIndex(closest);
      onIndexChange?.(closest);
    }
  }, [activeIndex, onIndexChange]);

  // Parallax + progress calculation on scroll
  const updateParallax = useCallback(() => {
    const track = trackRef.current;
    if (!track || prefersReducedMotion) return;

    const trackCenterX = track.scrollLeft + track.clientWidth / 2;
    const newData = Array.from(track.children).map((child, i) => {
      const el = child as HTMLElement;
      const childCenter = el.offsetLeft + el.offsetWidth / 2;
      const childWidth = el.offsetWidth;

      // p: -1 (left edge) to 1 (right edge), 0 = center
      const p = (childCenter - trackCenterX) / (childWidth / 2);
      const abs = Math.abs(Math.max(-1, Math.min(1, p)));

      // Progress bar: 0 at left edge, 100% at center, then back down
      const progress = Math.max(0, 1 - abs);

      return { p, abs, progress };
    });

    setParallaxData(newData);
    updateActiveIndex();
  }, [updateActiveIndex, prefersReducedMotion]);

  // Scroll snap listener
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const handleScroll = () => {
      updateParallax();
    };

    track.addEventListener("scroll", handleScroll, { passive: true });
    return () => track.removeEventListener("scroll", handleScroll);
  }, [updateParallax]);

  // IntersectionObserver: detect if carousel is in viewport
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInViewport(entry.isIntersecting);
      },
      { threshold: 0.1 }
    );

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Document.hidden listener
  useEffect(() => {
    const handleVisibilityChange = () => {
      // no-op, shouldAutoplay will re-evaluate
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  // Autoplay loop with requestAnimationFrame (proper pause/resume)
  useEffect(() => {
    if (!shouldAutoplay) {
      autoplayStateRef.current.elapsedMs = 0;
      return;
    }

    const autoplayTick = (now: number) => {
      const state = autoplayStateRef.current;
      if (state.lastFrameTime === 0) {
        state.lastFrameTime = now;
      }

      const delta = now - state.lastFrameTime;
      state.lastFrameTime = now;
      state.elapsedMs += delta;

      if (state.elapsedMs >= autoplayInterval) {
        state.elapsedMs = 0;
        state.lastFrameTime = now;

        // Advance to next slide
        setActiveIndex((prev) => {
          const next = (prev + 1) % slides.length;
          const track = trackRef.current;
          if (track) {
            const nextEl = track.children[next] as HTMLElement;
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

  // Video auto-play/pause: play if ≥60% in viewport, pause otherwise
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const checkVideos = () => {
      const trackCenterX = track.scrollLeft + track.clientWidth / 2;

      Array.from(track.children).forEach((child, i) => {
        const el = child as HTMLElement;
        const video = videoRefsMap.current.get(i);
        if (!video) return;

        const childLeft = el.offsetLeft;
        const childRight = childLeft + el.offsetWidth;
        const overlapStart = Math.max(childLeft, track.scrollLeft);
        const overlapEnd = Math.min(childRight, track.scrollLeft + track.clientWidth);
        const overlapWidth = Math.max(0, overlapEnd - overlapStart);
        const visibilityRatio = overlapWidth / el.offsetWidth;

        if (visibilityRatio >= 0.6) {
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      });
    };

    track.addEventListener("scroll", checkVideos, { passive: true });
    checkVideos();
    return () => track.removeEventListener("scroll", checkVideos);
  }, []);

  // Scroll slide into view by index
  const scrollToSlide = (index: number) => {
    const track = trackRef.current;
    if (!track) return;
    const el = track.children[index] as HTMLElement;
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  };

  const toggleAutoplay = () => {
    setIsPlaying((prev) => !prev);
    autoplayStateRef.current.elapsedMs = 0;
    autoplayStateRef.current.lastFrameTime = 0;
  };

  const isDesktop = typeof window !== "undefined" && window.innerWidth >= 900;

  return (
    <div ref={containerRef} className="w-full">
      <style jsx>{`
        .carousel-track {
          display: flex;
          gap: 1rem;
          overflow-x: auto;
          scroll-snap-type: x mandatory;
          overscroll-behavior-x: contain;
          padding-left: clamp(20px, 5vw, 48px);
          padding-right: clamp(20px, 5vw, 48px);
          scroll-behavior: smooth;

          /* iOS Safari: rounded + overflow fix */
          transform: translateZ(0);
          isolation: isolate;
        }

        .carousel-slide {
          flex-shrink: 0;
          width: min(82vw, 420px);
          aspect-ratio: ${aspectRatio};
          scroll-snap-align: center;
          scroll-snap-stop: always;
          border-radius: 32px;
          overflow: hidden;
          position: relative;

          /* Allow parallax transform */
          will-change: transform;
        }

        .carousel-media {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: ${slides[0]?.focus || "center"};
        }

        .carousel-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            to top,
            rgba(0, 0, 0, 0.85) 0%,
            rgba(0, 0, 0, 0.1) 60%,
            transparent 100%
          );
        }

        .carousel-text {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          padding: 24px;
          color: white;

          /* Parallax text effect */
          transform: translateX(calc(var(--p, 0) * -38%));
          opacity: calc(1 - var(--abs, 0) * 0.85);

          /* GPU acceleration */
          will-change: transform, opacity;
        }

        .carousel-text-prefers-reduced-motion {
          transform: none;
          opacity: 1;
        }

        .carousel-eyebrow {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.65);
          margin-bottom: 8px;
        }

        .carousel-title {
          font-size: 22px;
          font-weight: 700;
          line-height: 1.15;
          margin-bottom: 4px;
        }

        .carousel-desc {
          font-size: 14px;
          line-height: 1.5;
          color: rgba(255, 255, 255, 0.7);
          max-width: 30ch;
        }

        /* Pagination dots */
        .carousel-pagination {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-top: 24px;
          padding: 12px 16px;
          background: rgba(0, 0, 0, 0.4);
          border-radius: 999px;
          width: fit-content;
          margin-left: auto;
          margin-right: auto;
        }

        .carousel-dot {
          height: 8px;
          background: rgba(255, 255, 255, 0.3);
          border-radius: 4px;
          cursor: pointer;
          transition: all 300ms ease;
          flex-shrink: 0;

          /* Expand active dot */
          width: ${activeIndex === slides.length ? "8px" : "8px"};
        }

        .carousel-dot.active {
          width: 48px;
          background: white;
          position: relative;
        }

        .carousel-dot-progress {
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

        .carousel-play-pause {
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

        .carousel-play-pause:hover {
          background: rgba(255, 255, 255, 0.25);
        }

        /* Arrow buttons — desktop only */
        .carousel-arrows {
          display: none;
          gap: 8px;
          margin-top: 16px;
          justify-content: center;
        }

        @media (min-width: 900px) {
          .carousel-arrows {
            display: flex;
          }
        }

        .carousel-arrow {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: white;
          transition: all 200ms ease;
        }

        .carousel-arrow:hover {
          background: rgba(255, 255, 255, 0.2);
          transform: scale(1.05);
        }

        .carousel-arrow:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
      `}</style>

      {/* Track */}
      <div
        ref={trackRef}
        className="carousel-track no-scrollbar"
        role="region"
        aria-label="Carousel"
        aria-live="polite"
      >
        {slides.map((slide, i) => (
          <div
            key={i}
            className="carousel-slide"
            role="tabpanel"
            aria-selected={i === activeIndex}
          >
            {/* Media */}
            {slide.src.match(/\.(mp4|webm|mov)$/i) ? (
              <video
                ref={(el) => {
                  if (el) videoRefsMap.current.set(i, el);
                }}
                src={slide.src}
                muted
                loop
                playsInline
                className="carousel-media"
                aria-label={slide.alt || slide.title}
              />
            ) : (
              <Image
                src={slide.src}
                alt={slide.alt || slide.title}
                data-cms-key={slide.altCmsKey}
                fill
                sizes="(max-width: 768px) 82vw, min(82vw, 420px)"
                priority={i === 0}
                className="carousel-media"
                style={{ objectPosition: slide.focus || "center", objectFit: "cover" }}
              />
            )}

            {/* Overlay */}
            <div className="carousel-overlay" />

            {/* Text with parallax */}
            <div
              className={`carousel-text ${prefersReducedMotion ? "carousel-text-prefers-reduced-motion" : ""}`}
              style={{
                "--p": prefersReducedMotion ? 0 : parallaxData[i]?.p,
                "--abs": prefersReducedMotion ? 0 : parallaxData[i]?.abs,
              } as React.CSSProperties}
            >
              {slide.eyebrow && <div className="carousel-eyebrow">{slide.eyebrow}</div>}
              <h3 className="carousel-title">{slide.title}</h3>
              {slide.desc && <p className="carousel-desc">{slide.desc}</p>}
            </div>
          </div>
        ))}
      </div>

      {/* Pagination + Play/Pause */}
      <div className="carousel-pagination">
        {slides.map((_, i) => (
          <button
            key={i}
            className={`carousel-dot ${i === activeIndex ? "active" : ""}`}
            onClick={() => scrollToSlide(i)}
            role="tab"
            aria-selected={i === activeIndex}
            aria-label={`Go to slide ${i + 1}`}
          >
            {i === activeIndex && (
              <div
                className="carousel-dot-progress"
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
          className="carousel-play-pause"
          onClick={toggleAutoplay}
          aria-pressed={isPlaying}
          aria-label={isPlaying ? "Pause carousel" : "Play carousel"}
        >
          {isPlaying ? <Pause size={20} /> : <Play size={20} />}
        </button>
      </div>

      {/* Arrow buttons — desktop */}
      <div className="carousel-arrows">
        <button
          className="carousel-arrow"
          onClick={() => scrollToSlide(Math.max(0, activeIndex - 1))}
          disabled={activeIndex === 0}
          aria-label="Previous slide"
        >
          <ChevronLeft size={20} />
        </button>
        <button
          className="carousel-arrow"
          onClick={() => scrollToSlide(Math.min(slides.length - 1, activeIndex + 1))}
          disabled={activeIndex === slides.length - 1}
          aria-label="Next slide"
        >
          <ChevronRight size={20} />
        </button>
      </div>
    </div>
  );
}
