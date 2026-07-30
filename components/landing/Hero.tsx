"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
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
  const [showHeadline, setShowHeadline] = useState(false);
  const [showButtons, setShowButtons] = useState(false);
  // Video plays once per page load (no loop). When it ends it cross-fades
  // into the static poster frame underneath — no abrupt freeze on the last
  // frame. A full page reload resets this state, so the video replays then.
  const [videoEnded, setVideoEnded] = useState(false);
  const t = useTranslations("hero");

  useEffect(() => {
    const timer = setTimeout(() => setShowHeadline(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!showHeadline) return;
    const timer = setTimeout(() => setShowButtons(true), 300);
    return () => clearTimeout(timer);
  }, [showHeadline]);

  return (
    <section
      data-nav-theme="dark"
      className="relative overflow-hidden bg-black"
      style={{ width: "100%", height: "100dvh" }}
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
        className="absolute inset-0 h-full w-full object-cover object-center md:hidden"
        style={{ filter: "brightness(1.3) contrast(1.05)" }}
      />
      <video
        className="absolute inset-0 h-full w-full object-cover object-center md:hidden"
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
      <div className="absolute bottom-0 left-1/2 hidden aspect-square w-[85vw] -translate-x-1/2 overflow-hidden md:block lg:w-[80vw] lg:max-w-[1000px] xl:w-[65vw] xl:max-w-[1100px]">
        <img
          src="/video/Space8_Main_Hero_Poster.jpg"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover [object-position:center_45%]"
          style={{ filter: "brightness(1.3) contrast(1.05)" }}
        />
        <video
          className="relative h-full w-full object-cover [object-position:center_45%]"
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

        {/* CTA buttons — pop in with bounce after headline appears.
            A semi-transparent backdrop keeps the buttons legible over the
            pool-table hero graphic (pocket/triangle overlap). */}
        <motion.div
          className="mt-10 md:mt-14"
          initial={{ opacity: 0, scale: 0.90 }}
          animate={showButtons ? { opacity: 1, scale: 1 } : {}}
          transition={{
            duration: 0.55,
            ease: [0.34, 1.56, 0.64, 1],
          }}
        >
          <div className="mx-auto flex w-fit flex-row flex-nowrap items-center justify-center gap-3 rounded-full bg-black/40 px-3 py-2.5 backdrop-blur-sm sm:px-4 sm:py-3">
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
                background: "transparent",
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
        </motion.div>
      </div>
    </section>
  );
}