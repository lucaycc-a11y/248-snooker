"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const PHOTOS = [
  "/images/space-infinity-1600.webp",
  "/images/space-eternity-1600.webp",
  "/images/table-detail-1600.webp",
  "/images/table-and-balls-1600.webp",
  "/images/venue-interior-1600.webp",
] as const;

export default function VenueHeroScroll() {
  const t = useTranslations("venueHero");
  const containerRef = useRef<HTMLDivElement>(null);
  const pinSectionRef = useRef<HTMLDivElement>(null);
  const slideshowRef = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLDivElement>(null);
  const thumbnailRowRef = useRef<HTMLDivElement>(null);
  const ctxRef = useRef<gsap.Context | null>(null);
  const stRef = useRef<ScrollTrigger | null>(null);

  const [currentSlide, setCurrentSlide] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  // CSS crossfade slideshow (no swiper)
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % PHOTOS.length);
    }, 3200);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    const pinSection = pinSectionRef.current;
    const slideshow = slideshowRef.current;
    const headline = headlineRef.current;
    const thumbnailRow = thumbnailRowRef.current;

    if (!container || !pinSection || !slideshow || !headline || !thumbnailRow) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    const ctx = gsap.context(() => {
      const isMobileView = window.innerWidth < 768;
      const scrollLength = isMobileView ? 4 : 6;

      // Compute exact scale on init and refresh
      const thumbnails = gsap.utils.toArray<HTMLElement>(".venue-hero-thumbnail");
      const placeholders = gsap.utils.toArray<HTMLElement>(".venue-hero-placeholder");

      const computeScale = () => {
        if (placeholders.length === 0 || thumbnails.length === 0) return 0.2;
        const placeholderRect = placeholders[0].getBoundingClientRect();
        const thumbnailRect = thumbnails[0].getBoundingClientRect();
        return placeholderRect.width / thumbnailRect.width;
      };

      const st = ScrollTrigger.create({
        trigger: container,
        start: "top top",
        end: `+=${scrollLength * window.innerHeight}`,
        pin: pinSection,
        scrub: 1.2,
        invalidateOnRefresh: true,
        onRefresh: () => {
          // Recompute scale on refresh
          const exactScale = computeScale();
          gsap.set(thumbnails, { scale: exactScale });
        },
        onUpdate: (self) => {
          const progress = self.progress;

          // Phase 1: Slideshow fades out (0 → 0.2)
          if (progress <= 0.2) {
            gsap.set(slideshow, { opacity: 1 - progress / 0.2 });
          } else {
            gsap.set(slideshow, { opacity: 0 });
          }

          // Phase 2: Thumbnails scale down to centre (0.2 → 0.4)
          if (progress > 0.2 && progress <= 0.4) {
            const phase2 = (progress - 0.2) / 0.2;
            const exactScale = computeScale();
            gsap.set(thumbnails, { scale: 1 - (1 - exactScale) * phase2 });
            gsap.set(thumbnailRow, { justifyContent: phase2 < 0.5 ? "flex-start" : "center" });
          }

          // Phase 3: Thumbnails fly into placeholders (0.4 → 0.7)
          if (progress > 0.4 && progress <= 0.7) {
            const phase3 = (progress - 0.4) / 0.3;

            thumbnails.forEach((thumb, i) => {
              const placeholder = placeholders[i];
              if (!placeholder) return;

              const thumbRect = thumb.getBoundingClientRect();
              const placeholderRect = placeholder.getBoundingClientRect();

              const dx = placeholderRect.left - thumbRect.left;
              const dy = placeholderRect.top - thumbRect.top;

              gsap.set(thumb, { x: dx * phase3, y: dy * phase3 });
            });
          }

          // Phase 4: Headline segments fade in at random order (0.7 → 1.0)
          if (progress > 0.7) {
            const phase4 = (progress - 0.7) / 0.3;
            const segments = gsap.utils.toArray<HTMLElement>(".venue-hero-segment");

            // Staggered random fade-in
            segments.forEach((seg, i) => {
              const delay = i * 0.15;
              const segProgress = Math.max(0, Math.min(1, (phase4 - delay) / 0.3));
              gsap.set(seg, { opacity: segProgress });
            });
          }

          // Remove duplicate icons from body when scrolling back above 60%
          if (progress < 0.6) {
            document.querySelectorAll(".venue-hero-duplicate-icon").forEach(el => el.remove());
          }
        },
      });

      stRef.current = st;
    }, container);

    ctxRef.current = ctx;

    return () => {
      if (stRef.current) {
        stRef.current.kill();
        stRef.current = null;
      }
      ctx.revert();
    };
  }, [isMobile]);

  const prefersReducedMotion = typeof window !== "undefined"
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;

  if (prefersReducedMotion) {
    // Static layout for reduced motion
    return (
      <section className="relative w-full min-h-[100svh] bg-black text-white flex flex-col items-center justify-center px-6">
        <div className="relative w-full max-w-6xl aspect-[16/10] rounded-3xl overflow-hidden mb-12">
          <Image
            src={PHOTOS[0]}
            alt={t("photos.0.alt")}
            fill
            priority
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/35 to-black/75" />
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
            <h1 className="text-5xl md:text-7xl font-bold mb-4" style={{ fontFamily: "var(--font-good-times)" }}>
              {t("title")}
            </h1>
            <p className="text-sm md:text-base text-white/70 tracking-widest">
              {t("subtitle")}
            </p>
          </div>
        </div>

        <div className="max-w-4xl text-center space-y-4">
          {Array.from({ length: PHOTOS.length }).map((_, i) => (
            <p key={i} className="text-xl md:text-2xl">
              {t(`segments.${i}`)}
            </p>
          ))}
        </div>
      </section>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full bg-black">
      <div ref={pinSectionRef} className="relative w-full h-[100svh] overflow-hidden">

        {/* Slideshow layer with intro title */}
        <div ref={slideshowRef} className="absolute inset-0 z-10">
          <div className="relative w-full h-full">
            {PHOTOS.map((photo, i) => (
              <Image
                key={photo}
                src={photo}
                alt={t(`photos.${i}.alt`)}
                fill
                priority={i === 0}
                loading={i === 0 ? undefined : "lazy"}
                className="object-cover transition-opacity duration-[1200ms]"
                style={{ opacity: currentSlide === i ? 1 : 0 }}
              />
            ))}
            <div className="absolute inset-0 bg-gradient-to-b from-black/35 to-black/75" />

            {/* Intro title */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-white px-6">
              <h1 className="text-5xl md:text-7xl font-bold mb-4" style={{ fontFamily: "var(--font-good-times)" }}>
                {t("title")}
              </h1>
              <p className="text-sm md:text-base text-white/70 tracking-widest uppercase">
                {t("subtitle")}
              </p>
            </div>
          </div>
        </div>

        {/* Thumbnail row */}
        <div
          ref={thumbnailRowRef}
          className="absolute bottom-8 left-0 right-0 z-20 flex gap-4 px-6"
          style={{ justifyContent: "flex-start" }}
        >
          {PHOTOS.map((photo, i) => (
            <div
              key={photo}
              className="venue-hero-thumbnail relative w-24 h-24 md:w-32 md:h-32 rounded-2xl overflow-hidden border border-white/20"
            >
              <Image
                src={photo}
                alt={t(`photos.${i}.alt`)}
                fill
                className="object-cover"
              />
            </div>
          ))}
        </div>

        {/* Headline layer */}
        <div ref={headlineRef} className="absolute inset-0 z-30 flex items-center justify-center px-6">
          <div className="max-w-4xl text-white text-center space-y-2">
            {Array.from({ length: PHOTOS.length }).map((_, i) => (
              <div key={i} className="venue-hero-segment flex items-center justify-center gap-4 text-xl md:text-3xl font-medium opacity-0">
                <span>{t(`segments.${i}`)}</span>
                <div className="venue-hero-placeholder w-12 h-12 md:w-16 md:h-16 rounded-xl border border-white/20" />
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
