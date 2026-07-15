"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Logo } from "@/components/brand";

const GREEN = "#22C55E";

// "屬於你的主場" — iPad-Pro style left-to-right gradient across the whole string
const HEADLINE_GRADIENT: React.CSSProperties = {
  backgroundImage:
    "linear-gradient(100deg, #3D1A08 5%, #6B3015 10%, #8B4513 18%, #A0522D 26%, #C87941 34%, #DEB887 42%, #F5DEB3 50%, #E8F5E0 56%, #A8D5A2 62%, #6BBF6B 68%, #3D8B3D 76%, #1F5C1F 84%, #0D3D0D 92%, #071F07 100%)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  WebkitTextFillColor: "transparent",
};

export default function Hero() {
  const [showHeadline, setShowHeadline] = useState(false);
  const t = useTranslations("hero");

  useEffect(() => {
    const timer = setTimeout(() => setShowHeadline(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <section
      data-nav-theme="dark"
      className="relative overflow-hidden bg-black"
      style={{ width: "100%", height: "100dvh" }}
    >
      {/* Video background — full-screen on mobile, square anchored bottom on desktop */}
      {/* TODO: 需要 Luca 提供正確素材 — 中式桌球枱 hero 影片/照片（現有片為英式枱，暫用佔位） */}
      {/* Mobile: full-bleed cover */}
      <video
        className="absolute inset-0 h-full w-full object-cover object-center md:hidden"
        style={{ filter: "brightness(1.3) contrast(1.05)" }}
        autoPlay
        loop
        muted
        playsInline
        poster="/video/hero-poster.jpg"
      >
        <source src="/video/248Snooker_hero.mp4" type="video/mp4" />
      </video>

      {/* Desktop: bottom-anchored square, black sides */}
      <div className="absolute bottom-0 left-1/2 hidden aspect-square w-[85vw] -translate-x-1/2 overflow-hidden md:block lg:w-[80vw] lg:max-w-[1000px] xl:w-[65vw] xl:max-w-[1100px]">
        <video
          className="h-full w-full object-cover [object-position:center_45%]"
          style={{ filter: "brightness(1.3) contrast(1.05)" }}
          autoPlay
          loop
          muted
          playsInline
          poster="/video/hero-poster.jpg"
        >
          <source src="/video/248Snooker_hero.mp4" type="video/mp4" />
        </video>
      </div>

      {/* Subtle bottom gradient — keeps buttons readable over the table */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
          pointerEvents: "none",
          background:
            "linear-gradient(to bottom, transparent 0%, transparent 60%, rgba(0,0,0,0.35) 100%)",
        }}
      />

      {/* Content — centred on mobile, top-anchored on desktop */}
      <div className="absolute left-1/2 top-[28%] z-10 flex w-full -translate-x-1/2 flex-col items-center px-6 text-center md:top-[22%]">
        {/* Space8 wordmark — official SVG artwork, not a text simulation */}
        <div style={{ marginBottom: "4px" }}>
          <Logo variant="full" theme="dark" size={34} />
        </div>

        {/* Headline — single element, gradient, fades in after 3s */}
        <motion.h1
          initial={{ opacity: 0 }}
          animate={{ opacity: showHeadline ? 1 : 0 }}
          transition={{ duration: 1.2, ease: "easeIn" }}
          className="text-[clamp(48px,10vw,64px)] md:text-[72px]"
          style={{
            ...HEADLINE_GRADIENT,
            fontWeight: 600,
            letterSpacing: "-0.015em",
            lineHeight: 1.04,
            whiteSpace: "normal",
            fontFamily:
              "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif",
          }}
        >
          {t("tagline")}
        </motion.h1>

        {/* Sub copy */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: showHeadline ? 1 : 0 }}
          transition={{ duration: 1.2, ease: "easeIn", delay: 0.2 }}
          className="mt-4 text-[15px] md:text-[18px]"
          style={{
            color: "rgba(255,255,255,0.72)",
            fontWeight: 400,
            letterSpacing: "-0.01em",
            fontFamily:
              "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif",
          }}
        >
          {t("subline")}
        </motion.p>

        {/* CTA buttons — directly below headline, centred on all screens */}
        <div className="mt-10 md:mt-14 flex w-full flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/book"
            prefetch
            className="flex min-h-11 w-full items-center justify-center px-[25px] py-[14px] text-[13px] transition-[transform,filter] duration-200 hover:scale-[1.03] hover:brightness-[1.08] active:scale-95 sm:w-auto md:px-[28px] md:py-[12px] md:text-[15px]"
            style={{
              background: GREEN,
              color: "#000",
              borderRadius: "100px",
              fontWeight: 700,
              letterSpacing: "-0.01em",
              textDecoration: "none",
            }}
          >
            {t("cta_book")}
          </Link>

          <Link
            href="/venue"
            className="flex w-full items-center justify-center gap-2 px-[22px] py-[10px] text-[13px] transition-colors duration-200 hover:bg-white/[0.08] active:scale-[0.97] sm:w-auto md:px-[28px] md:py-[12px] md:text-[15px]"
            style={{
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.28)",
              color: "rgba(255,255,255,0.82)",
              borderRadius: "100px",
              fontWeight: 400,
              textDecoration: "none",
            }}
          >
            {t("cta_learn")}
          </Link>
        </div>
      </div>
    </section>
  );
}
