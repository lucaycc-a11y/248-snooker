"use client";

// Static 8-photo ring hero — no scroll interaction.
// The ring stays fixed on screen; centre block fades out as user scrolls past.

import * as React from "react";
import { useRef, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";

import { SpaceWheel, type SpaceWheelItem } from "@/components/ui/works-wheel";
import manifest from "@/public/images/space8-about-photos/manifest.json";

// All 8 photos from manifest (ring-only, no points)
const ITEMS: SpaceWheelItem[] = manifest.items.map((item) => ({
  title: item.title,
  description: item.description,
  image: `/images/space8-about-photos/${item.file.replace(/\.jpg$/, ".webp")}`,
  alt: item.alt,
  // No point index — all 8 are ring-only
}));

const GREEN_WORD_INDEX = 2;

interface RingCentreProps {
  opacity: number;
}

function RingCentre({ opacity }: RingCentreProps) {
  const t = useTranslations("aboutPage");
  const words = t.raw("hero_rotating_words") as string[];
  const [wordIdx, setWordIdx] = useState(0);
  const [maxWordWidth, setMaxWordWidth] = useState(0);
  const wordRef = useRef<HTMLSpanElement>(null);

  // Measure widest word
  useEffect(() => {
    if (!wordRef.current) return;
    let max = 0;
    words.forEach((word) => {
      const span = document.createElement("span");
      span.textContent = word;
      span.style.fontFamily = "'Noto Sans TC', sans-serif";
      span.style.fontSize = "clamp(1.25rem, 5.5vw, 1.875rem)";
      span.style.fontWeight = "700";
      span.style.visibility = "hidden";
      span.style.position = "absolute";
      document.body.appendChild(span);
      max = Math.max(max, span.offsetWidth);
      document.body.removeChild(span);
    });
    setMaxWordWidth(max);
  }, [words]);

  // Cycle words every 2.8s
  useEffect(() => {
    const id = setInterval(
      () => setWordIdx((i) => (i + 1) % words.length),
      2800,
    );
    return () => clearInterval(id);
  }, [words.length]);

  const activeWord = words[wordIdx] ?? "";
  const isGreen = wordIdx === GREEN_WORD_INDEX;

  return (
    <div
      className="flex flex-col items-center gap-3 text-center pointer-events-none select-none"
      style={{ opacity }}
    >
      {/* Logo */}
      <div style={{ display: "inline-flex", alignItems: "baseline" }}>
        <Image
          src="/logos/logo-black-horizontal.svg"
          alt="SPACE8"
          width={120}
          height={40}
          style={{
            height: "clamp(1.5rem, 7.5vw, 2.25rem)",
            width: "auto",
          }}
          priority
        />
      </div>

      {/* Heading: "一個" + rotating word + "的空間" */}
      <div
        className="flex items-center justify-center gap-0 flex-wrap"
        style={{
          fontSize: "clamp(1.25rem, 5.5vw, 1.875rem)",
        }}
      >
        <span
          className="font-semibold"
          style={{
            fontFamily: "'Noto Sans TC', sans-serif",
            color: "#000000",
            lineHeight: 1.2,
            marginRight: "0.25em",
          }}
        >
          一個
        </span>
        <div
          className="overflow-hidden flex items-center justify-center"
          style={{
            minWidth: Math.max(maxWordWidth, 100),
            height: "1.4em",
          }}
        >
          <AnimatePresence mode="wait">
            <motion.span
              key={wordIdx}
              ref={wordRef}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.35, ease: [0.2, 0.7, 0.3, 1] }}
              className="font-semibold"
              style={{
                fontFamily: "'Noto Sans TC', sans-serif",
                color: isGreen ? "#22c55e" : "#000000",
                lineHeight: 1.2,
              }}
            >
              {activeWord}
            </motion.span>
          </AnimatePresence>
        </div>
        <span
          className="font-semibold"
          style={{
            fontFamily: "'Noto Sans TC', sans-serif",
            color: "#000000",
            lineHeight: 1.2,
            marginLeft: "0.25em",
          }}
        >
          的空間
        </span>
      </div>

      {/* Body text */}
      <p
        className="leading-relaxed mt-2"
        style={{
          fontFamily: "'Noto Sans TC', sans-serif",
          fontSize: "clamp(14px, 3.5vw, 14px)",
          color: "#000000",
          maxWidth: "90%",
          textWrap: "balance",
        }}
      >
        <span className="font-semibold">好的中式桌球室不應有多餘干擾。</span>
        <span style={{ color: "rgba(0,0,0,0.72)" }}>
          {" "}SPACE8 自助無煙中式桌球獨立球室。隨時隨地，網上預訂專屬球枱。由預訂、付款到入場，全程自助，毋需等候。
        </span>
      </p>

      {/* Buttons */}
      <div className="flex gap-3 justify-center mt-4 pointer-events-auto flex-wrap">
        <button
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            background: "#22c55e",
            color: "#000000",
            fontWeight: 700,
            fontSize: "14px",
            padding: "12px 24px",
            borderRadius: "8px",
            border: "none",
            cursor: "pointer",
            height: "44px",
            minHeight: "44px",
            fontFamily: "'Noto Sans TC', sans-serif",
          }}
          onClick={() => {
            const bookPath = window.location.pathname.replace("/about", "/book");
            window.location.href = bookPath;
          }}
        >
          {t("hero_cta_primary")}
        </button>
        <button
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            background: "transparent",
            color: "#000000",
            fontWeight: 700,
            fontSize: "14px",
            padding: "12px 24px",
            borderRadius: "8px",
            border: "2px solid #000000",
            cursor: "pointer",
            height: "44px",
            minHeight: "44px",
            fontFamily: "'Noto Sans TC', sans-serif",
          }}
          onClick={() => {
            const venuePath = window.location.pathname.replace("/about", "/venue");
            window.location.href = venuePath;
          }}
        >
          {t("hero_cta_secondary")}
        </button>
      </div>
    </div>
  );
}

export function SpaceWheelHero() {
  const heroRef = useRef<HTMLDivElement>(null);
  const turnRef = useRef(0);
  const [centreOpacity, setCentreOpacity] = useState(1);

  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;

    // As user scrolls down, fade out centre block gradually
    const handleScroll = () => {
      const rect = hero.getBoundingClientRect();
      // When top of hero reaches top of viewport, start fading
      const progress = Math.max(0, Math.min(1, -rect.top / rect.height));
      setCentreOpacity(Math.max(0, 1 - progress));
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div
      ref={heroRef}
      className="relative w-full"
      style={{
        height: "100svh",
        backgroundColor: "#ffffff",
        overflow: "hidden",
      }}
    >
      {/* Static 8-photo ring, no scroll interaction */}
      <SpaceWheel
        items={ITEMS}
        turnRef={turnRef}
        className="absolute inset-0"
        ringTilt={1}
        ringOuterRatio={0.73}
        ringCardWidthRatio={0.24}
        navHeight={64}
        label={<RingCentre opacity={centreOpacity} />}
      />

      {/* Top fade overlay */}
      <div
        className="pointer-events-none absolute top-0 left-0 right-0 z-10"
        style={{
          height: "10%",
          background: "linear-gradient(to bottom, #ffffff, rgba(255,255,255,0))",
        }}
      />

      {/* Bottom fade overlay */}
      <div
        className="pointer-events-none absolute bottom-0 left-0 right-0 z-10"
        style={{
          height: "22%",
          background: "linear-gradient(to bottom, rgba(255,255,255,0), #ffffff)",
        }}
      />
    </div>
  );
}

export default SpaceWheelHero;
