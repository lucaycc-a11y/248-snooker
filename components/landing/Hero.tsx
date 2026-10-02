"use client";

import { useState, useRef } from "react";
import Image from "next/image";
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoEnded, setVideoEnded] = useState(false);
  const t = useTranslations("hero");

  return (
    // Section is exactly 100dvh tall, black background fills any horizontal
    // space outside the square photo on wide viewports.
    <section
      data-nav-theme="dark"
      className="relative bg-black"
      style={{
        width: "100%",
        height: "100dvh",
        overflow: "hidden", // clips square photo that overflows on narrow viewports
      }}
    >
      {/* Square photo container — height = 100dvh, width = height, centered.
          On narrow viewports it overflows left/right (clipped by section overflow:hidden).
          On wide viewports it sits centered with black on either side. */}
      <div
        className="hero__bg absolute top-0 left-1/2 -translate-x-1/2"
        style={{
          width: "100dvh",
          height: "100dvh",
          pointerEvents: "none",
        }}
      >
        {/* Poster frame — shown until video loads */}
        <Image
          src="/video/Space8_Main_Hero_Poster.jpg"
          alt={t("image_alt")}
          fill
          sizes="100dvh"
          quality={85}
          priority
          className="absolute inset-0 object-cover"
          style={{
            filter: "brightness(1.3) contrast(1.05)",
            objectPosition: "center center",
          }}
        />

        {/* Video — fades out once it ends so poster shows as a clean loop end */}
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          style={{
            filter: "brightness(1.3) contrast(1.05)",
            objectPosition: "center center",
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
      </div>

      {/* Text overlay — vertically centered with a slight upward nudge so the
          content sits mid-frame above the snooker table. No background scrim —
          text sits directly on the photo. */}
      <div
        ref={heroContentRef}
        className="absolute inset-x-0 z-10 flex flex-col items-center px-6 text-center"
        style={{
          top: "50%",
          transform: "translateY(calc(-50% - 6svh))",
          paddingTop: "clamp(24px, 4svh, 48px)",
          paddingBottom: "clamp(24px, 4svh, 48px)",
          pointerEvents: "none",
        }}
      >
        <div
          className="flex w-full flex-col items-center"
          style={{
            maxWidth: "min(560px, 88vw)",
            gap: "clamp(6px, 1.2svh, 16px)",
          }}
        >
          {/* SPACE8 Logo */}
          <div className="anime-reveal-wrapper" data-anime-hero-item>
            <Logo variant="full" theme="dark" size={28} />
          </div>

          {/* Headline — reduced from previous size to avoid dominating at all viewports */}
          <div className="anime-reveal-wrapper">
            <h1
              data-anime-hero-item
              style={{
                ...HEADLINE_GRADIENT,
                fontSize: "clamp(28px, min(7.5vw, 6svh), 72px)",
                fontWeight: 700,
                letterSpacing: "-0.015em",
                lineHeight: 1.06,
                margin: 0,
                whiteSpace: "normal",
                fontFamily:
                  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif",
              }}
            >
              {t("tagline")}
            </h1>
          </div>

          {/* Subtext */}
          <div className="anime-reveal-wrapper">
            <p
              data-anime-hero-item
              style={{
                fontSize: "clamp(13px, min(2.2vw, 1.8svh), 16px)",
                color: "rgba(255,255,255,0.78)",
                fontWeight: 400,
                letterSpacing: "-0.01em",
                fontFamily:
                  "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif",
                margin: 0,
              }}
            >
              {t("subline")}
            </p>
          </div>

          {/* CTA buttons */}
          <div className="anime-reveal-wrapper" data-anime-hero-item>
            <div className="pointer-events-auto">
              <div
                className="mx-auto flex w-fit flex-row flex-nowrap items-center justify-center"
                style={{
                  gap: "clamp(10px, 1vw, 14px)",
                  paddingTop: "clamp(4px, 0.6svh, 10px)",
                }}
              >
                <Link
                  href="/book"
                  prefetch
                  className="flex items-center justify-center rounded-full font-bold leading-none transition-[transform,filter] duration-200 hover:scale-[1.03] hover:brightness-[1.08] active:scale-95"
                  style={{
                    background: GREEN,
                    color: "#000",
                    fontSize: "clamp(13px, 0.6vw + 0.5rem, 15px)",
                    padding: "0.75rem clamp(1.5rem, 2vw, 1.75rem)",
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
                    fontSize: "clamp(13px, 0.6vw + 0.5rem, 15px)",
                    padding: "0.75rem clamp(1.5rem, 2vw, 1.75rem)",
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
