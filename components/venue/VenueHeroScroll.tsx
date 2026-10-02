"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export default function VenueHeroScroll() {
  const t = useTranslations("venueHero");
  const containerRef = useRef<HTMLDivElement>(null);

  // Room photos found in public/images/rooms/
  const photos = [
    { src: "/images/rooms/space-infinity-1.jpg", alt: "Space Infinity 桌球室" },
    { src: "/images/rooms/space-infinity-2.jpg", alt: "Space Infinity 球桌設施" },
    { src: "/images/rooms/space-eternity-1.jpg", alt: "Space Eternity 桌球室" },
    { src: "/images/rooms/space-eternity-2.jpg", alt: "Space Eternity 球桌設施" },
    { src: "/images/rooms/space-infinity-3.jpg", alt: "Space Infinity 環境" },
  ];

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Reduced motion: show static layout
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: container,
          start: "top top",
          end: "+=300%",
          pin: true,
          scrub: 1,
        },
      });

      // Fade in text segments sequentially
      tl.fromTo(
        ".hero-segment",
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, stagger: 0.15, duration: 0.4, ease: "cubic-bezier(.2,.7,.3,1)" },
        0.2
      );
    }, container);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={containerRef} className="relative h-[400vh]" data-nav-theme="dark">
      <div className="sticky top-0 h-screen overflow-hidden">
        {/* Photo slideshow with CSS crossfade */}
        <div className="absolute inset-0">
          {photos.map((photo, i) => (
            <div
              key={i}
              className="hero-photo absolute inset-0"
              style={{
                backgroundImage: `url(${photo.src})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                animation: `crossfade 16s ${i * 3.2}s infinite`,
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
            background: "linear-gradient(to bottom, rgba(0,0,0,0.35), rgba(0,0,0,0.75))",
          }}
        />

        {/* Text overlay */}
        <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-6">
          <h1 className="text-white font-black text-5xl md:text-7xl leading-tight mb-4">
            {t("title")}
          </h1>
          <p className="text-white/80 text-lg md:text-xl mb-8 tracking-wide">
            {t("subtitle")}
          </p>
          <div className="space-y-3 max-w-3xl">
            {[0, 1, 2, 3, 4].map((i) => (
              <p
                key={i}
                className="hero-segment text-white/90 text-base md:text-lg font-medium"
              >
                {t(`segments.${i}`)}
              </p>
            ))}
          </div>
        </div>

        {/* CSS keyframes for crossfade */}
        <style jsx>{`
          @keyframes crossfade {
            0% { opacity: 0; }
            6.25% { opacity: 1; }
            31.25% { opacity: 1; }
            37.5% { opacity: 0; }
            100% { opacity: 0; }
          }

          @media (prefers-reduced-motion: reduce) {
            .hero-photo {
              animation: none !important;
            }
            .hero-segment {
              opacity: 1 !important;
              transform: none !important;
            }
          }
        `}</style>
      </div>
    </div>
  );
}
