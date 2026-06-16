"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

const GREEN = "#1A6B35";

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

  useEffect(() => {
    const timer = setTimeout(() => setShowHeadline(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  const handleLearnMore = () => {
    document
      .getElementById("social-proof")
      ?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section
      className="relative overflow-hidden bg-black"
      style={{ width: "100%", height: "100dvh" }}
    >
      {/* Video background — full-screen on mobile, square anchored bottom on desktop */}
      {/* Mobile: full-bleed cover */}
      <video
        className="absolute inset-0 h-full w-full object-cover object-center md:hidden"
        style={{ filter: "brightness(1.3) contrast(1.05)" }}
        autoPlay
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
        {/* "248 Snooker" — thin, static */}
        <p
          className="text-[clamp(28px,6vw,38px)] md:text-[42px]"
          style={{
            color: "rgba(255,255,255,0.92)",
            fontWeight: 700,
            letterSpacing: "-0.022em",
            lineHeight: 1.1,
            fontFamily:
              "'SF Pro Display', 'SF Pro Text', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Helvetica, Arial, sans-serif",
            marginBottom: "4px",
          }}
        >
          248 Snooker
        </p>

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
          屬於你的主場
        </motion.h1>

        {/* CTA buttons — directly below headline, static */}
        <div className="mt-10 md:mt-14 flex flex-col items-center justify-center gap-6 sm:flex-row">
          <button
            type="button"
            onClick={handleLearnMore}
            className="w-full px-[25px] py-[14px] text-[13px] transition-[transform,filter] duration-200 hover:scale-[1.03] hover:brightness-[1.08] active:scale-[0.97] sm:w-auto md:px-[28px] md:py-[12px] md:text-[15px]"
            style={{
              background: GREEN,
              color: "white",
              borderRadius: "100px",
              fontWeight: 600,
              letterSpacing: "-0.01em",
            }}
          >
            立即預訂
          </button>

          <button
            type="button"
            onClick={handleLearnMore}
            className="flex w-full items-center justify-center gap-2 px-[22px] py-[10px] text-[13px] transition-colors duration-200 hover:bg-white/[0.08] active:scale-[0.97] sm:w-auto md:px-[28px] md:py-[12px] md:text-[15px]"
            style={{
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.28)",
              color: "rgba(255,255,255,0.82)",
              borderRadius: "100px",
              fontWeight: 400,
            }}
          >
            了解更多
            <motion.span
              aria-hidden="true"
              animate={{ y: [0, 4, 0] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
              style={{ display: "inline-block" }}
            >
              ↓
            </motion.span>
          </button>
        </div>
      </div>
    </section>
  );
}
