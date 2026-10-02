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

export default function VenueHeroScrollAnimation() {
  const t = useTranslations("venueHero");
  const containerRef = useRef<HTMLDivElement>(null);
  const heroSectionRef = useRef<HTMLElement>(null);
  const animatedIconsRef = useRef<HTMLDivElement>(null);
  const heroHeaderRef = useRef<HTMLDivElement>(null);
  const iconElementsRef = useRef<(HTMLDivElement | null)[]>([]);
  const textSegmentsRef = useRef<(HTMLSpanElement | null)[]>([]);
  const placeholdersRef = useRef<(HTMLDivElement | null)[]>([]);
  const duplicateIconsRef = useRef<HTMLElement[]>([]);
  const textAnimationOrderRef = useRef<Array<{ segment: HTMLElement; originalIndex: number }>>([]);
  const scrollTriggerContextRef = useRef<gsap.Context | null>(null);
  const [scrollLength, setScrollLength] = useState(6);
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

  // Determine scroll length based on viewport
  useEffect(() => {
    const updateScrollLength = () => {
      setScrollLength(window.innerWidth < 768 ? 4 : 6);
    };
    updateScrollLength();
    window.addEventListener("resize", updateScrollLength);
    return () => window.removeEventListener("resize", updateScrollLength);
  }, []);

  useEffect(() => {
    if (showStaticLayout || !heroSectionRef.current) return;

    const textSegments = textSegmentsRef.current.filter(Boolean) as HTMLElement[];
    const animationOrder: Array<{ segment: HTMLElement; originalIndex: number }> = [];

    textSegments.forEach((segment, index) => {
      animationOrder.push({ segment, originalIndex: index });
    });

    // Fisher-Yates shuffle for random text fade-in order
    for (let i = animationOrder.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [animationOrder[i], animationOrder[j]] = [animationOrder[j], animationOrder[i]];
    }

    textAnimationOrderRef.current = animationOrder;

    // Compute scale based on viewport
    const isMobile = window.innerWidth < 768;
    const headerIconSize = isMobile ? 35 : 60;
    const currentIconSize = iconElementsRef.current[0]?.getBoundingClientRect().width || 1;
    const exactScale = headerIconSize / currentIconSize;

    // Use gsap.context() to isolate this animation's ScrollTriggers
    const ctx = gsap.context(() => {
      const trigger = ScrollTrigger.create({
        trigger: heroSectionRef.current!,
        start: "top top",
        end: `+=${window.innerHeight * scrollLength}px`,
        pin: true,
        pinSpacing: true,
        scrub: 1,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          const progress = self.progress;

          // Reset all text opacity
          textSegments.forEach((segment) => {
            gsap.set(segment, { opacity: 0 });
          });

          // Phase 1: Header moves up and fades out, icons move down
          if (progress < 0.3) {
            const moveProgress = progress / 0.3;
            const containerMoveY = -window.innerHeight * 0.3 * moveProgress;

            if (progress < 0.15) {
              const headerProgress = progress / 0.15;
              gsap.set(heroHeaderRef.current, {
                transform: `translateY(${-50 * headerProgress}px)`,
                opacity: 1 - headerProgress,
              });
            } else {
              gsap.set(heroHeaderRef.current, {
                transform: "translateY(-50px)",
                opacity: 0,
              });
            }

            // Clean up duplicate icons from previous phase
            duplicateIconsRef.current.forEach((d) => d.parentNode?.removeChild(d));
            duplicateIconsRef.current = [];

            gsap.set(animatedIconsRef.current, {
              x: 0,
              y: containerMoveY,
              scale: 1,
              opacity: 1,
            });

            // Icons follow the container movement
            iconElementsRef.current.forEach((icon, index) => {
              if (icon) {
                const staggerDelay = index * 0.1;
                const iconProgress = gsap.utils.mapRange(
                  staggerDelay,
                  staggerDelay + 0.5,
                  0,
                  1,
                  moveProgress
                );
                const clamped = Math.max(0, Math.min(1, iconProgress));
                gsap.set(icon, {
                  x: 0,
                  y: (-containerMoveY) * (1 - clamped),
                });
              }
            });

            // Fade out scroll hint
            gsap.set(".hero-scroll-hint", {
              opacity: Math.max(0, 1 - moveProgress * 10),
            });

            // Phase 2: Icons scale to center
          } else if (progress < 0.6) {
            const scaleProgress = (progress - 0.3) / 0.3;

            gsap.set(heroHeaderRef.current, {
              transform: "translateY(-50px)",
              opacity: 0,
            });

            duplicateIconsRef.current.forEach((d) => d.parentNode?.removeChild(d));
            duplicateIconsRef.current = [];

            const containerRect = animatedIconsRef.current!.getBoundingClientRect();
            const deltaX =
              (window.innerWidth / 2 -
                (containerRect.left + containerRect.width / 2)) *
              scaleProgress;
            const deltaY =
              (window.innerHeight / 2 -
                (containerRect.top + containerRect.height / 2)) *
              scaleProgress;

            gsap.set(animatedIconsRef.current, {
              x: deltaX,
              y: -window.innerHeight * 0.3 + deltaY,
              scale: 1 + (exactScale - 1) * scaleProgress,
              opacity: 1,
            });

            iconElementsRef.current.forEach((icon) => {
              if (icon) gsap.set(icon, { x: 0, y: 0 });
            });

            // Phase 3: Icons move to placeholder positions
          } else if (progress < 0.75) {
            const moveProgress = (progress - 0.6) / 0.15;

            gsap.set(heroHeaderRef.current, {
              transform: "translateY(-50px)",
              opacity: 0,
            });

            const containerRect = animatedIconsRef.current!.getBoundingClientRect();
            const deltaX =
              window.innerWidth / 2 -
              (containerRect.left + containerRect.width / 2);
            const deltaY =
              window.innerHeight / 2 -
              (containerRect.top + containerRect.height / 2);

            gsap.set(animatedIconsRef.current, {
              x: deltaX,
              y: -window.innerHeight * 0.3 + deltaY,
              scale: exactScale,
              opacity: 0,
            });

            iconElementsRef.current.forEach((icon) => {
              if (icon) gsap.set(icon, { x: 0, y: 0 });
            });

            // Create duplicate icons positioned absolutely
            if (duplicateIconsRef.current.length === 0) {
              iconElementsRef.current.forEach((icon) => {
                if (icon) {
                  const duplicate = icon.cloneNode(true) as HTMLElement;
                  duplicate.className = "duplicate-icon";
                  Object.assign(duplicate.style, {
                    position: "fixed",
                    width: headerIconSize + "px",
                    height: headerIconSize + "px",
                    zIndex: "40",
                    pointerEvents: "none",
                  });
                  document.body.appendChild(duplicate);
                  duplicateIconsRef.current.push(duplicate);
                }
              });
            }

            // Animate duplicates to placeholders
            duplicateIconsRef.current.forEach((duplicate, index) => {
              if (index < placeholdersRef.current.length) {
                const iconRect =
                  iconElementsRef.current[index]!.getBoundingClientRect();
                const startPageX =
                  iconRect.left + iconRect.width / 2 + window.pageXOffset;
                const startPageY =
                  iconRect.top + iconRect.height / 2 + window.pageYOffset;

                const targetRect = placeholdersRef.current[index]!.getBoundingClientRect();
                const targetPageX =
                  targetRect.left + targetRect.width / 2 + window.pageXOffset;
                const targetPageY =
                  targetRect.top + targetRect.height / 2 + window.pageYOffset;

                const moveX = targetPageX - startPageX;
                const moveY = targetPageY - startPageY;

                let currentX = 0;
                let currentY =
                  moveProgress < 0.5
                    ? moveY * (moveProgress / 0.5)
                    : moveY;
                if (moveProgress >= 0.5) {
                  currentX = moveX * ((moveProgress - 0.5) / 0.5);
                }

                duplicate.style.left =
                  startPageX + currentX - headerIconSize / 2 + "px";
                duplicate.style.top =
                  startPageY + currentY - headerIconSize / 2 + "px";
                duplicate.style.opacity = "1";
                duplicate.style.display = "flex";
              }
            });

            // Phase 4: Text fades in
          } else {
            gsap.set(heroHeaderRef.current, {
              transform: "translateY(-100px)",
              opacity: 0,
            });
            gsap.set(animatedIconsRef.current, { opacity: 0 });

            // Position duplicates at final placeholder locations
            duplicateIconsRef.current.forEach((duplicate, index) => {
              if (index < placeholdersRef.current.length) {
                const targetRect = placeholdersRef.current[index]!.getBoundingClientRect();
                const targetPageX =
                  targetRect.left + targetRect.width / 2 + window.pageXOffset;
                const targetPageY =
                  targetRect.top + targetRect.height / 2 + window.pageYOffset;
                duplicate.style.left =
                  targetPageX - headerIconSize / 2 + "px";
                duplicate.style.top =
                  targetPageY - headerIconSize / 2 + "px";
                duplicate.style.opacity = "1";
                duplicate.style.display = "flex";
              }
            });

            // Fade in text segments in random order
            textAnimationOrderRef.current.forEach((item, randomIndex) => {
              const segStart = 0.75 + randomIndex * 0.03;
              const segProgress = gsap.utils.mapRange(
                segStart,
                segStart + 0.015,
                0,
                1,
                progress
              );
              gsap.set(item.segment, {
                opacity: Math.max(0, Math.min(1, segProgress)),
              });
            });
          }
        },
      });

      return () => {
        trigger.kill();
      };
    }, heroSectionRef);

    scrollTriggerContextRef.current = ctx;

    return () => {
      ctx.revert();
      duplicateIconsRef.current.forEach((d) => d.parentNode?.removeChild(d));
    };
  }, [showStaticLayout, scrollLength]);

  if (showStaticLayout) {
    return (
      <div
        ref={containerRef}
        className="relative bg-black w-full"
        style={{ minHeight: "100svh" }}
      >
        {/* Static layout for reduced motion */}
        <div className="absolute inset-0 overflow-hidden">
          <img
            src={heroPhotos[0].src}
            alt={heroPhotos[0].alt}
            className="w-full h-full object-cover"
          />
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "linear-gradient(to bottom, rgba(0,0,0,0.35), rgba(0,0,0,0.75))",
            }}
          />
        </div>

        <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-6 py-12">
          <h1 className="text-white text-3xl md:text-5xl font-black leading-tight mb-8">
            {t("intro_title") || "場地介紹"}
          </h1>
          <p className="text-white/60 text-sm md:text-base mb-12 tracking-widest">
            SPACE INFINITY · SPACE ETERNITY
          </p>

          <div className="space-y-4 max-w-2xl">
            {headlines.map((headline, i) => (
              <p
                key={i}
                className="text-white/90 text-sm md:text-base leading-relaxed"
                style={{
                  textWrap: "balance",
                  lineBreak: "strict",
                }}
              >
                {headline}
              </p>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full bg-black">
      <style jsx>{`
        @keyframes crossfade {
          0% {
            opacity: 0;
          }
          5% {
            opacity: 1;
          }
          30% {
            opacity: 1;
          }
          35% {
            opacity: 0;
          }
          100% {
            opacity: 0;
          }
        }

        @keyframes pulse-chevron {
          0%,
          100% {
            transform: translateY(0);
            opacity: 0.6;
          }
          50% {
            transform: translateY(6px);
            opacity: 1;
          }
        }

        .hero-photo {
          animation: crossfade 19.2s linear infinite;
        }

        .hero-scroll-hint {
          animation: pulse-chevron 2.4s cubic-bezier(0.4, 0, 0.2, 1) infinite;
          transition: opacity 0.3s ease;
        }

        @media (prefers-reduced-motion: reduce) {
          .hero-photo {
            animation: none !important;
          }
          .hero-scroll-hint {
            animation: none !important;
            opacity: 0.6 !important;
          }
        }
      `}</style>

      <section
        ref={heroSectionRef}
        className="relative w-full bg-black"
        style={{ height: "100svh" }}
        data-nav-theme="dark"
      >
        {/* Slideshow layer */}
        <div className="absolute inset-0 overflow-hidden">
          {heroPhotos.map((photo, i) => (
            <div
              key={i}
              className="hero-photo absolute inset-0"
              style={{
                backgroundImage: `url(${photo.src})`,
                backgroundSize: "cover",
                backgroundPosition:
                  i === 0 ? "center 30%" : i === 1 ? "center 60%" : "center",
                animation: `crossfade 19.2s ${i * 3.2}s linear infinite`,
                opacity: i === 0 ? 1 : 0,
              }}
              role="img"
              aria-label={photo.alt}
            />
          ))}
        </div>

        {/* Dark gradient overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(to bottom, rgba(0,0,0,0.35), rgba(0,0,0,0.75))",
          }}
        />

        {/* Caption label (fades with photo) */}
        <div className="absolute bottom-12 left-6 md:bottom-16 md:left-8 z-20">
          <p
            className="text-white/70 text-xs md:text-sm font-label tracking-widest"
            style={{
              opacity: 1,
              transition: "opacity 3.2s linear",
            }}
          >
            {captions[0]}
          </p>
        </div>

        {/* Scroll hint */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2">
          <p className="text-white/50 text-xs font-label tracking-widest hero-scroll-hint">
            {t("scroll_hint") || "向下滑動"}
          </p>
          <ChevronDown className="w-4 h-4 text-white/50 hero-scroll-hint" />
        </div>

        {/* Header (fades out early) */}
        <div
          ref={heroHeaderRef}
          className="absolute inset-0 z-10 flex flex-col items-center justify-center text-center px-6"
        >
          <h1 className="text-white text-4xl md:text-6xl font-black leading-tight mb-3">
            {t("intro_title") || "場地介紹"}
          </h1>
          <p className="text-white/60 text-xs md:text-sm font-label tracking-widest">
            SPACE INFINITY · SPACE ETERNITY
          </p>
        </div>

        {/* Thumbnail row (bottom, scales up and flies to text) */}
        <div
          ref={animatedIconsRef}
          className="fixed bottom-10 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 w-[90%] md:w-[80%] max-w-2xl"
          style={{ pointerEvents: "none" }}
        >
          {heroPhotos.map((_, index) => (
            <div
              key={index}
              ref={(el) => {
                iconElementsRef.current[index] = el;
              }}
              className="flex-1 aspect-square rounded-lg md:rounded-xl overflow-hidden bg-gray-900 border border-white/10"
              style={{
                willChange: "transform, opacity",
              }}
            >
              <img
                src={heroPhotos[index].src}
                alt={heroPhotos[index].alt}
                className="w-full h-full object-cover"
                loading={index === 0 ? "eager" : "lazy"}
              />
            </div>
          ))}
        </div>

        {/* Main headline with embedded placeholders */}
        <div className="absolute inset-0 z-10 flex items-center justify-center px-6">
          <h2
            className="text-white text-2xl md:text-5xl font-black leading-tight text-center max-w-4xl"
            style={{
              textWrap: "balance",
              lineBreak: "strict",
            }}
          >
            {headlines.map((headline, i) => (
              <span key={i}>
                <span
                  ref={(el) => {
                    textSegmentsRef.current[i] = el;
                  }}
                  className="text-segment opacity-0"
                  style={{
                    transition: "opacity 0.3s ease",
                  }}
                >
                  {headline}
                </span>
                <div
                  ref={(el) => {
                    placeholdersRef.current[i] = el;
                  }}
                  className="placeholder-icon mx-1 md:mx-2 md:my-1 w-6 h-6 md:w-12 md:h-12 inline-block align-middle rounded-lg overflow-hidden border border-white/10"
                  style={{
                    willChange: "transform, opacity",
                  }}
                >
                  <img
                    src={heroPhotos[i].src}
                    alt={heroPhotos[i].alt}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
              </span>
            ))}
          </h2>
        </div>
      </section>
    </div>
  );
}
