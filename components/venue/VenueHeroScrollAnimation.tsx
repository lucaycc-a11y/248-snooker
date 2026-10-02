"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ChevronDown } from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

interface HeroPhoto {
  src: string;
  alt: string;
}

interface ThumbnailPosition {
  x: number;
  y: number;
  scale: number;
}

export default function VenueHeroScrollAnimation() {
  const t = useTranslations("venueHero");
  const containerRef = useRef<HTMLDivElement>(null);
  const heroSectionRef = useRef<HTMLElement>(null);
  const runwayRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  const thumbnailRowRef = useRef<HTMLDivElement>(null);
  const thumbnailsRef = useRef<(HTMLDivElement | null)[]>([]);
  const headlinePlaceholdersRef = useRef<(HTMLDivElement | null)[]>([]);
  const textSegmentsRef = useRef<(HTMLSpanElement | null)[]>([]);

  const progressRef = useRef(0);
  const contextRef = useRef<gsap.Context | null>(null);

  const [showStaticLayout, setShowStaticLayout] = useState(false);

  // Hero photos: 6 points with captions
  const heroPhotos: HeroPhoto[] = [
    {
      src: "/images/hero-point-1-aramith-fallback.webp",
      alt: t("alt_1") || "球檯上的比利時 Aramith 比賽球",
    },
    {
      src: "/images/hero-point-2-xingpai-fallback.webp",
      alt: t("alt_2") || "SPACE8 包廂內的星牌桌球臺與特調燈光",
    },
    {
      src: "/images/space-pilot-scoreboard-中八桌球-香港新蒲崗.webp",
      alt: t("alt_3") || "Space Pilot 智能對戰管家的比分畫面",
    },
    {
      src: "/images/space-infinity-room-中八桌球-香港新蒲崗.webp",
      alt: t("alt_4") || "SPACE8 包廂入場自助系統",
    },
    {
      src: "/images/space-infinity-room-中八桌球-香港新蒲崗.webp",
      alt: t("alt_5") || "SPACE8 寬敞的私人桌球包廂",
    },
    {
      src: "/images/space8-about-photos/images/about-06-lounge.webp",
      alt: t("alt_6") || "SPACE8 舒適沙發休息區",
    },
  ];

  const captions = [
    t("caption_1") || "專業設備",
    t("caption_2") || "場地裝修",
    t("caption_3") || "科技體驗",
    t("caption_4") || "快捷方便",
    t("caption_5") || "無煙乾淨",
    t("caption_6") || "舒適自在",
  ];

  const headlines = [
    t("segment_0") || "精選桌球臺，比賽球",
    t("segment_1") || "特調燈光和氛圍",
    t("segment_2") || "AI 智能對戰管家",
    t("segment_3") || "全自助入場，掃碼即入",
    t("segment_4") || "全面禁煙，定期清潔",
    t("segment_5") || "舒適沙發休息區",
  ];

  // Check prefers-reduced-motion
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShowStaticLayout(true);
    }
  }, []);

  // Main scroll animation setup — single timeline, like About page
  useEffect(() => {
    if (showStaticLayout || !heroSectionRef.current || !stageRef.current) return;

    // Kill previous context
    if (contextRef.current) {
      contextRef.current.revert();
    }

    contextRef.current = gsap.context(() => {
      const isMobile = window.innerWidth < 768;
      const runway = runwayRef.current;
      const stage = stageRef.current;

      if (!runway || !stage) return;

      // Measure positions relative to pinned stage
      const stageRect = stage.getBoundingClientRect();
      const thumbnailPositions: ThumbnailPosition[] = [];
      const headlineBounds: Array<{ x: number; y: number; width: number; height: number }> = [];

      // Initial thumbnail positions (at bottom of screen)
      thumbnailsRef.current.forEach((thumb, i) => {
        if (thumb) {
          const rect = thumb.getBoundingClientRect();
          thumbnailPositions.push({
            x: rect.left - stageRect.left,
            y: rect.top - stageRect.top,
            scale: 1,
          });
        }
      });

      // Target headline placeholder positions
      headlinePlaceholdersRef.current.forEach((placeholder) => {
        if (placeholder) {
          const rect = placeholder.getBoundingClientRect();
          headlineBounds.push({
            x: rect.left - stageRect.left,
            y: rect.top - stageRect.top,
            width: rect.width,
            height: rect.height,
          });
        }
      });

      // Create ONE timeline driven by ScrollTrigger scrub
      const timeline = gsap.timeline({
        scrollTrigger: {
          trigger: runway,
          start: "top top",
          end: `+=${window.innerHeight * (isMobile ? 5 : 6)}px`,
          scrub: 0.6, // Match About page
          pin: stage,
          pinSpacing: false,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            progressRef.current = self.progress;
          },
        },
      });

      // PHASE 0 (0-0.15): Scroll hint fades, chevron animates
      timeline.to(
        ".hero-scroll-hint",
        { opacity: 0, duration: 0.15, ease: "none" },
        0
      );

      // PHASE 1 (0.15-0.4): Thumbnails move to headline placeholders
      // Stagger by 0.05 timeline duration = smoother wave
      thumbnailsRef.current.forEach((thumb, i) => {
        if (thumb && headlineBounds[i]) {
          const targetX = headlineBounds[i].x + headlineBounds[i].width / 2 - thumbnailPositions[i].x;
          const targetY = headlineBounds[i].y + headlineBounds[i].height / 2 - thumbnailPositions[i].y;

          timeline.to(
            thumb,
            {
              x: targetX,
              y: targetY,
              scale: 0.8,
              opacity: 1,
              ease: "power3.inOut",
              duration: 0.25,
            },
            0.15 + i * 0.03 // Stagger by 0.03 per thumbnail
          );
        }
      });

      // PHASE 2 (0.4-0.75): Text segments fade in (reading order, not random)
      textSegmentsRef.current.forEach((segment, i) => {
        if (segment) {
          timeline.to(
            segment,
            {
              opacity: 1,
              ease: "power2.inOut",
              duration: 0.08,
            },
            0.4 + i * 0.04 // Stagger by 0.04 per segment
          );
        }
      });

      // PHASE 3 (0.75-1.0): Content settles
      // (optional: scale thumbnails down further, fade others, etc.)

      return () => {
        timeline.kill();
        ScrollTrigger.getAll().forEach((st) => {
          if (st.trigger === runway) st.kill();
        });
      };
    });

    return () => {
      if (contextRef.current) {
        contextRef.current.revert();
      }
    };
  }, [showStaticLayout]);

  if (showStaticLayout) {
    // Static fallback layout
    return (
      <section ref={heroSectionRef} className="relative w-full h-screen bg-black overflow-hidden">
        <div className="flex items-center justify-center h-full">
          <div className="text-center text-white">
            <h1 className="text-4xl font-bold mb-4">{t("title") || "SPACE8 場地介紹"}</h1>
            <p className="text-lg opacity-75">{captions.join(" • ")}</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <>
      {/* Runway: tall enough to give GSAP scroll room */}
      <div
        ref={runwayRef}
        style={{ height: "600svh" }}
        className="relative bg-black"
      >
        {/* Sticky stage — GSAP pins it */}
        <div
          ref={stageRef}
          className="sticky top-0 w-full h-[100svh] overflow-hidden bg-black"
        >
          {/* Hero section container */}
          <section
            ref={heroSectionRef}
            className="relative w-full h-full flex flex-col items-center justify-center"
            data-cms-key="venue_hero_section"
          >
            {/* Top fade overlay */}
            <div className="pointer-events-none absolute top-0 left-0 right-0 z-10"
              style={{
                height: "10%",
                background: "linear-gradient(to bottom, #000000, rgba(0,0,0,0))",
              }}
            />

            {/* Hero content: thumbnails + headline placeholders */}
            <div className="relative w-full h-full flex flex-col items-center justify-center px-4">
              {/* Carousel carousel — visible at scroll start */}
              <div className="absolute inset-0 flex items-center justify-center opacity-75">
                <div className="text-6xl font-bold text-white/20">SPACE8</div>
              </div>

              {/* Thumbnail row — starts at bottom, animates to headline */}
              <div
                ref={thumbnailRowRef}
                className="absolute bottom-20 left-1/2 -translate-x-1/2 flex gap-4 z-20"
              >
                {heroPhotos.map((photo, i) => (
                  <div
                    key={i}
                    ref={(el) => { thumbnailsRef.current[i] = el; }}
                    className="relative w-16 h-16 md:w-20 md:h-20 rounded-lg overflow-hidden flex-shrink-0 bg-gray-900"
                    style={{
                      opacity: 0.7,
                      transform: "scale(1) translateX(0) translateY(0)",
                    }}
                  >
                    <img
                      src={photo.src}
                      alt={photo.alt}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>

              {/* Headline area with text segments and placeholders */}
              <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-full max-w-3xl px-4 z-20">
                <div className="space-y-6 md:space-y-8">
                  {headlines.map((headline, i) => (
                    <div key={i} className="relative">
                      {/* Placeholder marker for thumbnail endpoint (invisible) */}
                      <div
                        ref={(el) => { headlinePlaceholdersRef.current[i] = el; }}
                        className="absolute w-1 h-1 pointer-events-none"
                        style={{
                          left: "0",
                          top: "50%",
                          transform: "translate(-20px, -50%)",
                        }}
                      />
                      {/* Text segment */}
                      <span
                        ref={(el) => { textSegmentsRef.current[i] = el; }}
                        className="block text-2xl md:text-3xl font-bold text-white opacity-0"
                        data-cms-key={`venue_hero_segment_${i}`}
                      >
                        {headline}
                      </span>
                      {/* Caption */}
                      <span className="block text-sm md:text-base text-white/60 mt-1">
                        {captions[i]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Scroll hint */}
              <div className="hero-scroll-hint absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-20 opacity-100">
                <span className="text-sm text-white/60 uppercase tracking-widest">
                  {t("scroll_hint") || "向下滑動"}
                </span>
                <div className="animate-bounce">
                  <ChevronDown className="w-6 h-6 text-green-500" />
                </div>
              </div>
            </div>

            {/* Bottom fade overlay */}
            <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-10"
              style={{
                height: "22%",
                background: "linear-gradient(to bottom, rgba(0,0,0,0), #000000)",
              }}
            />
          </section>
        </div>
      </div>
    </>
  );
}
