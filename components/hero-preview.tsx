'use client';

import Image from 'next/image';
import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

export default function HeroPreview() {
  const maskRectRef = useRef<SVGRectElement>(null);
  const heroSectionRef = useRef<HTMLDivElement>(null);
  const fillPhotoRef = useRef<HTMLDivElement>(null);
  const fillMetallicRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    if (!maskRectRef.current || !heroSectionRef.current || !fillPhotoRef.current || !fillMetallicRef.current) return;

    // Determine xPercent based on viewport width
    const isMobile = window.innerWidth < 768;
    const xPercentValue = isMobile ? -350 : -410;

    const ctx = gsap.context(() => {
      // Step 2: Zoom animation (scale 250 → 1)
      gsap.fromTo(
        maskRectRef.current,
        {
          scale: 250,
          xPercent: xPercentValue,
          transformOrigin: '50% 50%',
        },
        {
          scale: 1,
          xPercent: 0,
          transformOrigin: '50% 50%',
          scrollTrigger: {
            trigger: heroSectionRef.current,
            scrub: 1,
            pin: true,
            start: 'top top',
            end: '+=3000',
          },
        }
      );

      // Step 3: Crossfade fill layers (photo → metallic)
      const crossfadeTimeline = gsap.timeline({
        scrollTrigger: {
          trigger: heroSectionRef.current,
          scrub: 1,
          start: '+=3000', // Start right after Step 2 ends
          end: '+=2000',
        },
      });

      crossfadeTimeline
        .to(fillPhotoRef.current, { opacity: 0, duration: 1 })
        .to(fillMetallicRef.current, { opacity: 1, duration: 1 }, '<');
    }, heroSectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <div
      ref={heroSectionRef}
      className="hero-section relative w-screen h-screen overflow-hidden"
    >
      {/* Permanent black background - never fades */}
      <div className="hero-bg-black absolute inset-0 z-[5] bg-black" />

      {/* Fill layers - crossfade between photo and metallic */}
      <div className="hero-fill-layer absolute inset-0 z-[6]">
        {/* Photo fill - fades out in Step 3 */}
        <div ref={fillPhotoRef} className="hero-fill-photo absolute inset-0 opacity-100">
          <Image
            src="/images/space-infinity-room-中八桌球-香港新蒲崗.webp"
            alt="Space Infinity Room"
            fill
            className="object-cover"
            priority
          />
        </div>
        {/* Metallic fill - fades in during Step 3 */}
        <div
          ref={fillMetallicRef}
          className="hero-fill-metallic absolute inset-0 opacity-0"
          style={{
            backgroundImage:
              'linear-gradient(90.128deg, rgb(124, 120, 120) 2.6068%, rgb(221, 221, 221) 41.449%, rgb(210, 210, 210) 62.509%, rgb(124, 120, 120) 99.947%)',
          }}
        />
      </div>

      {/* Table 2: Space Eternity - HIDDEN (for future steps) */}
      <div className="absolute inset-0 z-0 opacity-0">
        <Image
          src="/images/space-eternity-room-中八桌球-香港新蒲崗.webp"
          alt="Space Eternity Room"
          fill
          className="object-cover"
          priority
        />
      </div>

      {/* SVG Mask Layer - Step 2, never modified in Step 3 */}
      <svg
        className="hero-mask-svg absolute inset-0 z-[10] w-full h-full"
        viewBox="0 0 1920 1080"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <mask id="hero-mask-infinity">
            {/* White background = show black rect */}
            <rect x="0" y="0" width="1920" height="1080" fill="white" />
            {/* Black text = hide black rect (reveal fill layers beneath) */}
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
        {/* Black rect with mask - Step 2 controls this, Step 3 doesn't touch it */}
        <rect
          ref={maskRectRef}
          className="hero-mask-rect"
          x="0"
          y="0"
          width="1920"
          height="1080"
          fill="#000000"
          mask="url(#hero-mask-infinity)"
        />
      </svg>
    </div>
  );
}
