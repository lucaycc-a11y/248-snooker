'use client';

import Image from 'next/image';
import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

export default function HeroPreview() {
  const maskRectRef = useRef<SVGRectElement>(null);
  const maskRectEternityRef = useRef<SVGRectElement>(null);
  const heroSectionRef = useRef<HTMLDivElement>(null);
  const fillPhotoRef = useRef<HTMLDivElement>(null);
  const fillMetallicRef = useRef<HTMLDivElement>(null);
  const fillEternityMetallicRef = useRef<HTMLDivElement>(null);
  const fillEternityPhotoRef = useRef<HTMLDivElement>(null);
  const subtitleRowRef = useRef<HTMLDivElement>(null);
  const infinityAndOrGroupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    if (
      !maskRectRef.current ||
      !maskRectEternityRef.current ||
      !heroSectionRef.current ||
      !fillPhotoRef.current ||
      !fillMetallicRef.current ||
      !fillEternityMetallicRef.current ||
      !fillEternityPhotoRef.current ||
      !subtitleRowRef.current ||
      !infinityAndOrGroupRef.current
    )
      return;

    // Determine xPercent based on viewport width
    // NOTE: these values still need visual tuning against the actual "I" / "E" position
    const isMobile = window.innerWidth < 768;
    const xPercentValue = isMobile ? -350 : -500;
    const eternityXPercentValue = isMobile ? -300 : -450; // targets the "E" in ETERNITY — needs re-tuning now that the eternity box uses its own local viewBox (500x100) instead of the full-screen one

    const ZOOM_DURATION = 3000; // Step 2: Infinity zoom-out scroll distance (px)
    const FADE_DURATION = 2000; // Step 3: Infinity crossfade to metallic (px)
    const SUBTITLE_DURATION = 1500; // Step 4a: "OR SPACE ETERNITY" fades/rises in (px)
    const ETERNITY_FADE_DURATION = 1500; // Step 4b: Eternity metallic -> hollow crossfade (px)
    const ZOOM2_DURATION = 3000; // Step 5: zoom into "E", fade out Infinity+OR, reveal Table 2 (px)
    const TOTAL_DURATION =
      ZOOM_DURATION + FADE_DURATION + SUBTITLE_DURATION + ETERNITY_FADE_DURATION + ZOOM2_DURATION;

    const ctx = gsap.context(() => {
      // ONE continuous pin + ONE master timeline spanning all 5 steps, so the
      // section never unpins partway through and every stage plays while locked.
      const master = gsap.timeline({
        scrollTrigger: {
          trigger: heroSectionRef.current,
          scrub: 1,
          pin: true,
          start: 'top top',
          end: `+=${TOTAL_DURATION}`,
        },
      });

      // ---- Step 2: "Space Infinity" zoom animation (huge -> locked size) ----
      master.fromTo(
        maskRectRef.current,
        {
          scale: 400,
          xPercent: xPercentValue,
          transformOrigin: '50% 50%',
        },
        {
          scale: 0.8, // locked size, user-tuned value — do not change
          xPercent: 0,
          transformOrigin: '50% 50%',
          duration: ZOOM_DURATION / TOTAL_DURATION,
          ease: 'none',
        }
      );

      // ---- Step 3: Crossfade Infinity fill layers (photo -> metallic) ----
      master.to(fillPhotoRef.current, {
        opacity: 0,
        duration: FADE_DURATION / TOTAL_DURATION,
        ease: 'none',
      });
      master.to(
        fillMetallicRef.current,
        { opacity: 1, duration: FADE_DURATION / TOTAL_DURATION, ease: 'none' },
        '<'
      );

      // ---- Step 4a: "OR SPACE ETERNITY" rises up from nothing ----
      master.fromTo(
        subtitleRowRef.current,
        { opacity: 0, y: 24 },
        {
          opacity: 1,
          y: 0,
          duration: SUBTITLE_DURATION / TOTAL_DURATION,
          ease: 'none',
        }
      );

      // ---- Step 4b: "Space Eternity" crossfades from metallic -> hollow (reveals Table 2) ----
      // Mirror of Step 3, but reversed: starts visible/metallic, ends hollow.
      master.to(fillEternityMetallicRef.current, {
        opacity: 0,
        duration: ETERNITY_FADE_DURATION / TOTAL_DURATION,
        ease: 'none',
      });
      master.to(
        fillEternityPhotoRef.current,
        { opacity: 1, duration: ETERNITY_FADE_DURATION / TOTAL_DURATION, ease: 'none' },
        '<'
      );

      // ---- Step 5: Zoom into "E", fade out Infinity + OR, reveal Table 2 ----
      master.to(maskRectEternityRef.current, {
        scale: 400,
        xPercent: eternityXPercentValue,
        transformOrigin: '50% 50%',
        duration: ZOOM2_DURATION / TOTAL_DURATION,
        ease: 'none',
      });
      // "Space Infinity" (title + its fill layers) and "OR" fade away together
      // while the Eternity zoom plays. Note: this only fades the wrapping group's
      // opacity — it never touches .hero-mask-rect's own opacity, so Step 2/3's
      // internal crossfade logic stays untouched.
      master.to(
        infinityAndOrGroupRef.current,
        { opacity: 0, duration: ZOOM2_DURATION / TOTAL_DURATION, ease: 'none' },
        '<'
      );
    }, heroSectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <div
      ref={heroSectionRef}
      className="hero-section relative w-full h-screen overflow-hidden"
    >
      {/* Permanent black background - never fades, never touched by any step */}
      <div className="hero-bg-black absolute inset-0 z-[5] bg-black" />

      {/* ===== Group: "Space Infinity" title + "OR" subtitle label ===== */}
      {/* This whole group fades out together in Step 5 (see infinityAndOrGroupRef) */}
      <div ref={infinityAndOrGroupRef} className="absolute inset-0 z-[6]">
        {/* Infinity fill layers - crossfade between photo and metallic (Step 3) */}
        <div className="hero-fill-layer absolute inset-0">
          <div ref={fillPhotoRef} className="hero-fill-photo absolute inset-0 opacity-100">
            <Image
              src="/images/space-infinity-room-中八桌球-香港新蒲崗.webp"
              alt="Space Infinity Room"
              fill
              className="object-cover"
              priority
            />
          </div>
          <div
            ref={fillMetallicRef}
            className="hero-fill-metallic absolute inset-0 opacity-0"
            style={{
              backgroundImage:
                'linear-gradient(90.128deg, rgb(58, 58, 58) 2.6068%, rgb(245, 245, 245) 41.449%, rgb(225, 225, 225) 62.509%, rgb(58, 58, 58) 99.947%)',
            }}
          />
        </div>

        {/* SVG Mask Layer for "SPACE INFINITY" - Step 2 zoom target */}
        <svg
          className="hero-mask-svg absolute inset-0 z-[10] w-full h-full"
          viewBox="0 0 1920 1080"
          preserveAspectRatio="xMidYMid slice"
        >
          <defs>
            <mask id="hero-mask-infinity">
              <rect x="-960" y="-540" width="3840" height="2160" fill="white" />
              <text
                x="50%"
                y="50%"
                dy="0.35em"
                textAnchor="middle"
                fontFamily="Good Times, sans-serif"
                fontWeight="400"
                fontSize="120"
                fill="black"
              >
                SPACE INFINITY
              </text>
            </mask>
          </defs>
          <rect
            ref={maskRectRef}
            className="hero-mask-rect"
            x="-960"
            y="-540"
            width="3840"
            height="2160"
            fill="#000000"
            mask="url(#hero-mask-infinity)"
          />
        </svg>

        {/* "OR" label - part of the subtitle row, fades in with Eternity in Step 4a */}
        <div
          ref={subtitleRowRef}
          className="absolute inset-x-0 z-[11] flex items-center justify-center gap-3"
          style={{ top: '65%' }} // sits below the main title — adjust to match final layout
        >
          <span
            className="text-[2.5vw] font-normal tracking-wide"
            style={{ fontFamily: "'Good Times', sans-serif", color: '#ffffff' }}
          >
            OR
          </span>

          {/* ===== "SPACE ETERNITY" — its own mask + fill layers (Step 4b / Step 5 target) ===== */}
          {/* This box has its own local viewBox matching ITS OWN aspect ratio (5:1),
              instead of reusing the full-screen 1920x1080 viewBox from the main title.
              That mismatch (5:1 box vs 1.78:1 viewBox) was why "slice" blew the content
              up way past the box — no visible text-hole, just a giant uncropped photo
              rectangle bleeding over "OR". */}
          <div className="relative" style={{ width: '40vw', height: '8vw' }}>
            <div className="hero-eternity-fill-layer absolute inset-0">
              <div
                ref={fillEternityMetallicRef}
                className="absolute inset-0 opacity-100"
                style={{
                  backgroundImage:
                    'linear-gradient(90.128deg, rgb(58, 58, 58) 2.6068%, rgb(245, 245, 245) 41.449%, rgb(225, 225, 225) 62.509%, rgb(58, 58, 58) 99.947%)',
                }}
              />
              <div ref={fillEternityPhotoRef} className="absolute inset-0 opacity-0">
                <Image
                  src="/images/space-eternity-room-中八桌球-香港新蒲崗.webp"
                  alt="Space Eternity Room"
                  fill
                  className="object-cover"
                  priority
                />
              </div>
            </div>

            <svg
              className="absolute inset-0 w-full h-full"
              viewBox="0 0 500 100"
              preserveAspectRatio="xMidYMid slice"
            >
              <defs>
                <mask id="hero-mask-eternity">
                  {/* Oversized by ~3x relative to the 500x100 local box, same buffer
                      logic as the main title's mask, scaled to this box's own units */}
                  <rect x="-500" y="-100" width="1500" height="300" fill="white" />
                  <text
                    x="50%"
                    y="50%"
                    dy="0.35em"
                    textAnchor="middle"
                    fontFamily="Good Times, sans-serif"
                    fontWeight="400"
                    fontSize="60"
                    fill="black"
                  >
                    SPACE ETERNITY
                  </text>
                </mask>
              </defs>
              <rect
                ref={maskRectEternityRef}
                x="-500"
                y="-100"
                width="1500"
                height="300"
                fill="#000000"
                mask="url(#hero-mask-eternity)"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* Table 2: full-screen photo revealed once the Eternity zoom (Step 5) covers the viewport */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/images/space-eternity-room-中八桌球-香港新蒲崗.webp"
          alt="Space Eternity Room"
          fill
          className="object-cover"
          priority
        />
      </div>
    </div>
  );
}