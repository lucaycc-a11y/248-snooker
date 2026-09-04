"use client";

import { useState, useEffect } from "react";
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
  const [videoEnded, setVideoEnded] = useState(false);
  const t = useTranslations("hero");

  return (
    <section
      data-nav-theme="dark"
      className="relative overflow-hidden bg-black"
      style={{ width: "100%", height: "100svh", minHeight: "100svh" }}
    >
      {/* Video background — full-screen on mobile, square anchored bottom on desktop */}
      {/* TODO: 需要 Luca 提供正確素材 — 中式桌球枱 hero 影片/照片（現有片為英式枱，暫用佔位） */}
      {/* Plays once per page load. On `ended` the video fades out over the
          static end-frame image beneath it (same poster composition), so the
          section settles into a designed still instead of freezing mid-frame. */}
      {/* Mobile: full-bleed cover */}
      <img
        src="/video/Space8_Main_Hero_Poster.jpg"
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover [object-position:center_70%] md:hidden"
        style={{ filter: "brightness(1.3) contrast(1.05)" }}
      />
      <video
        className="absolute inset-0 h-full w-full object-cover [object-position:center_70%] md:hidden"
        style={{
          filter: "brightness(1.3) contrast(1.05)",
          opacity: videoEnded ? 0 : 1,
          transition: "opacity 1.6s ease-out",
        }}
        autoPlay
        muted
        playsInline
        poster="/video/Space8_Main_Hero_Poster.jpg"
        onEnded={() => setVideoEnded(true)}
      >
        <source src="/video/Space8_Main_Hero.mp4" type="video/mp4" />
      </video>

      {/* Desktop: bottom-anchored square, black sides */}
      <motion.div
        className="absolute bottom-0 left-1/2 hidden aspect-square w-[85vw] overflow-hidden md:block lg:w-[80vw] lg:max-w-[1000px] xl:w-[65vw] xl:max-w-[1100px]"
        whileHover={{ scale: 1.025 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        style={{ x: "-50%", transformOrigin: "center bottom", willChange: "transform" }}
      >
        <img
          src="/video/Space8_Main_Hero_Poster.jpg"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover [object-position:center_65%]"
          style={{ filter: "brightness(1.3) contrast(1.05)" }}
        />
        <video
          className="relative h-full w-full object-cover [object-position:center_65%]"
          style={{
            filter: "brightness(1.3) contrast(1.05)",
            opacity: videoEnded ? 0 : 1,
            transition: "opacity 1.6s ease-out",
          }}
          autoPlay
          muted
          playsInline
          poster="/video/Space8_Main_Hero_Poster.jpg"
          onEnded={() => setVideoEnded(true)}
        >
          <source src="/video/Space8_Main_Hero.mp4" type="video/mp4" />
        </video>
      </motion.div>

      {/* Subtle bottom gradient — keeps buttons readable over the table */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
          pointerEvents: "none",
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.15) 35%, transparent 60%, rgba(0,0,0,0.4) 100%)",
        }}
      />

      {/* Content — flex-centered with responsive bottom guard-rail to prevent overlap with the pool-table graphic.
          pointer-events-none lets the table's hover effect work through the full-bleed container. */}
      <div
        ref={heroContentRef}
        className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center px-6 text-center pb-[clamp(60px,18svh,180px)] md:pb-[clamp(80px,20svh,200px)]"
      >
        {/* Space8 wordmark — official SVG artwork, not a text simulation */}
        <div data-anime-hero-item style={{ marginBottom: "6px" }}>
          <Logo variant="full" theme="dark" size={32} />
        </div>

        {/* Headline — single element, gradient, fades in after 3s */}
        <h1
          data-anime-hero-item
          className="text-[clamp(44px,9vw,60px)] md:text-[68px]"
          style={{
            ...HEADLINE_GRADIENT,
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

        {/* Sub copy */}
        <p
          data-anime-hero-item
          className="mt-3 text-[14px] md:mt-3.5 md:text-[17px]"
          style={{
            color: "rgba(255,255,255,0.72)",
            fontWeight: 400,
            letterSpacing: "-0.01em",
            fontFamily:
              "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif",
          }}
        >
          {t("subline")}
        </p>

        {/* CTA buttons — tightened gap from subtitle for better composition.
            pointer-events-auto re-enables clicks suppressed by the overlay container. */}
        <div data-anime-hero-item className="pointer-events-auto mt-4 md:mt-5">
          <div className="mx-auto flex w-fit flex-row flex-nowrap items-center justify-center gap-3 rounded-full px-3 py-2.5 sm:px-4 sm:py-3">
            <Link
              href="/book"
              prefetch
              className="flex min-h-11 items-center justify-center rounded-full px-6 py-3 text-[13px] font-bold leading-none transition-[transform,filter] duration-200 hover:scale-[1.03] hover:brightness-[1.08] active:scale-95 md:px-7 md:py-3 md:text-[15px]"
              style={{
                background: GREEN,
                color: "#000",
                letterSpacing: "-0.01em",
                textDecoration: "none",
                minHeight: 44,
                minWidth: 44,
              }}
            >
              {t("cta_book")}
            </Link>

            <Link
              href="/venue"
              className="flex items-center justify-center rounded-full border px-6 py-3 text-[13px] leading-none transition-colors duration-200 hover:bg-white/[0.08] active:scale-[0.97] md:px-7 md:py-3 md:text-[15px]"
              style={{
                background: "rgba(255,255,255,0.08)",
                backdropFilter: "blur(10px)",
                WebkitBackdropFilter: "blur(10px)",
                border: "1px solid rgba(255,255,255,0.28)",
                color: "rgba(255,255,255,0.82)",
                fontWeight: 400,
                textDecoration: "none",
                minHeight: 44,
                minWidth: 44,
              }}
            >
              {t("cta_learn")}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}