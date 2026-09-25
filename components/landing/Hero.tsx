"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useAnimeEntrance } from "@/lib/anime-reveal";
import { Logo } from "@/components/brand";

const GREEN = "#22C55E";

// "屬於你的空間" — iPad-Pro style left-to-right gradient across the whole string
const HEADLINE_GRADIENT: React.CSSProperties = {
  backgroundImage:
    "linear-gradient(100deg, #3D1A08 5%, #6B3015 10%, #8B4513 18%, #A0522D 26%, #C87941 34%, #DEB887 42%, #F5DEB3 50%, #E8F5E0 56%, #A8D5A2 62%, #6BBF6B 68%, #3D8B3D 76%, #1F5C1F 84%, #0D3D0D 92%, #071F07 100%)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  WebkitTextFillColor: "transparent",
};

export default function Hero() {
  const heroContentRef = useAnimeEntrance<HTMLDivElement>({
    selector: "[data-anime-hero-item]",
    delay: 120,
    duration: 900,
    distance: 18,
  });
  const mobileVideoRef = useRef<HTMLVideoElement>(null);
  const desktopVideoRef = useRef<HTMLVideoElement>(null);
  const [videoEnded, setVideoEnded] = useState(false);
  const t = useTranslations("hero");

  return (
    <section
      data-nav-theme="dark"
      className="relative overflow-hidden bg-black"
      style={{
        width: "100%",
        height: "100dvh",
        minHeight: "100dvh",
      }}
    >
      {/* Mobile: full-viewport edge-to-edge table */}
      <img
        src="/video/Space8_Main_Hero_Poster.jpg"
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full translate-y-[4%] object-cover [object-position:center_68%] md:hidden"
        style={{ filter: "brightness(1.3) contrast(1.05)" }}
      />
      <video
        ref={mobileVideoRef}
        className="absolute inset-0 h-full w-full translate-y-[4%] object-cover [object-position:center_68%] md:hidden"
        style={{
          filter: "brightness(1.3) contrast(1.05)",
          opacity: videoEnded ? 0 : 1,
          transition: "opacity 1.6s ease-out",
        }}
        autoPlay
        muted
        playsInline
        controls={false}
        disablePictureInPicture
        disableRemotePlayback
        poster="/video/Space8_Main_Hero_Poster.jpg"
        onEnded={() => setVideoEnded(true)}
      >
        <source src="/video/Space8_Main_Hero.mp4" type="video/mp4" />
      </video>

      {/* Desktop: large perspective wedge occupying most of the hero area */}
      <motion.div
        className="absolute bottom-0 left-1/2 hidden aspect-square overflow-hidden md:block"
        whileHover={{ scale: 1.025 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        style={{
          x: "-50%",
          transformOrigin: "center bottom",
          willChange: "transform",
          width: "clamp(900px, 95vw, 1600px)",
          height: "clamp(900px, 95vh, 1600px)",
        }}
      >
        <img
          src="/video/Space8_Main_Hero_Poster.jpg"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full translate-y-[4%] object-cover [object-position:center_71%]"
          style={{ filter: "brightness(1.3) contrast(1.05)" }}
        />
        <video
          ref={desktopVideoRef}
          className="relative h-full w-full translate-y-[4%] object-cover [object-position:center_71%]"
          style={{
            filter: "brightness(1.3) contrast(1.05)",
            opacity: videoEnded ? 0 : 1,
            transition: "opacity 1.6s ease-out",
          }}
          autoPlay
          muted
          playsInline
          controls={false}
          disablePictureInPicture
          disableRemotePlayback
          poster="/video/Space8_Main_Hero_Poster.jpg"
          onEnded={() => setVideoEnded(true)}
        >
          <source src="/video/Space8_Main_Hero.mp4" type="video/mp4" />
        </video>
      </motion.div>

      {/* Gradient overlay — ensures text readability over the large table */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
          pointerEvents: "none",
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.3) 25%, rgba(0,0,0,0.15) 50%, transparent 70%, rgba(0,0,0,0.3) 100%)",
        }}
      />

      {/* Content stack — centered in viewport, sitting on top of the large table.
          Text block remains horizontally centered with constrained max-width for readability. */}
      <div
        ref={heroContentRef}
        className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center px-6 text-center"
      >
        {/* Constrained content column for large screens */}
        <div
          className="flex w-full flex-col items-center"
          style={{ maxWidth: "min(720px, 90vw)" }}
        >
          {/* SPACE8 Logo — centered above headline */}
          <div
            className="anime-reveal-wrapper"
            data-anime-hero-item
            style={{ marginBottom: "clamp(8px, 1.2vh, 16px)" }}
          >
            <Logo variant="full" theme="dark" size={32} />
          </div>

          {/* Headline — fluid sizing, centered */}
          <div className="anime-reveal-wrapper">
            <h1
              data-anime-hero-item
              style={{
                ...HEADLINE_GRADIENT,
                fontSize: "clamp(2.25rem, 5.5vw + 1rem, 4.5rem)", // 36px → 72px fluid
                fontWeight: 600,
                letterSpacing: "-0.015em",
                lineHeight: 1.04,
                margin: 0,
                whiteSpace: "normal",
                fontFamily:
                  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif",
              }}
            >
              {t("tagline")}
            </h1>
          </div>

          {/* Subtext — fluid sizing */}
          <div className="anime-reveal-wrapper">
            <p
              data-anime-hero-item
              style={{
                marginTop: "clamp(0.625rem, 1vh, 1rem)", // 10px → 16px
                fontSize: "clamp(0.875rem, 0.8vw + 0.5rem, 1.125rem)", // 14px → 18px
                color: "rgba(255,255,255,0.72)",
                fontWeight: 400,
                letterSpacing: "-0.01em",
                fontFamily:
                  "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif",
              }}
            >
              {t("subline")}
            </p>
          </div>

          {/* CTA buttons — fluid sizing with enforced 44px tap targets */}
          <div className="anime-reveal-wrapper" data-anime-hero-item>
            <div
              className="pointer-events-auto"
              style={{
                marginTop: "clamp(1rem, 2vh, 1.5rem)", // 16px → 24px
              }}
            >
              <div
                className="mx-auto flex w-fit flex-row flex-nowrap items-center justify-center rounded-full"
                style={{
                  gap: "clamp(0.625rem, 1vw, 0.875rem)", // 10px → 14px
                  padding: "clamp(0.5rem, 0.8vh, 0.75rem)",
                }}
              >
                <Link
                  href="/book"
                  prefetch
                  className="flex items-center justify-center rounded-full font-bold leading-none transition-[transform,filter] duration-200 hover:scale-[1.03] hover:brightness-[1.08] active:scale-95"
                  style={{
                    background: GREEN,
                    color: "#000",
                    fontSize: "clamp(0.8125rem, 0.6vw + 0.5rem, 0.9375rem)", // 13px → 15px
                    padding: "0.75rem clamp(1.5rem, 2vw, 1.75rem)", // Fixed py: 12px, fluid px
                    letterSpacing: "-0.01em",
                    textDecoration: "none",
                    minHeight: "44px",
                    minWidth: "44px",
                  }}
                >
                  {t("cta_book")}
                </Link>

                <Link
                  href="/venue"
                  className="flex items-center justify-center rounded-full border leading-none transition-colors duration-200 hover:bg-white/[0.08] active:scale-[0.97]"
                  style={{
                    background: "rgba(255,255,255,0.08)",
                    backdropFilter: "blur(10px)",
                    WebkitBackdropFilter: "blur(10px)",
                    border: "1px solid rgba(255,255,255,0.28)",
                    color: "rgba(255,255,255,0.82)",
                    fontSize: "clamp(0.8125rem, 0.6vw + 0.5rem, 0.9375rem)", // 13px → 15px
                    padding: "0.75rem clamp(1.5rem, 2vw, 1.75rem)", // Fixed py: 12px, fluid px
                    fontWeight: 400,
                    textDecoration: "none",
                    minHeight: "44px",
                    minWidth: "44px",
                  }}
                >
                  {t("cta_learn")}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
