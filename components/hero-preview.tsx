'use client';

import Image from 'next/image';
import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

export default function HeroPreview() {
  const maskRectRef = useRef<SVGRectElement>(null);
  const heroSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    if (!maskRectRef.current || !heroSectionRef.current) return;

    // Determine xPercent based on viewport width
    const isMobile = window.innerWidth < 768;
    const xPercentValue = isMobile ? -350 : -410;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        maskRectRef.current,
        {
          scale: 130,
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
    }, heroSectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <div
      ref={heroSectionRef}
      className="hero-section relative w-screen h-screen overflow-hidden"
    >
      {/* Table 1: Space Infinity - VISIBLE (underneath mask) */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/images/space-infinity-room-中八桌球-香港新蒲崗.webp"
          alt="Space Infinity Room"
          fill
          className="object-cover"
          priority
        />
      </div>

      {/* Table 2: Space Eternity - HIDDEN */}
      <div className="absolute inset-0 z-0 opacity-0">
        <Image
          src="/images/space-eternity-room-中八桌球-香港新蒲崗.webp"
          alt="Space Eternity Room"
          fill
          className="object-cover"
          priority
        />
      </div>

      {/* SVG Mask Layer - black background with text cutout */}
      <svg
        className="hero-mask-svg absolute inset-0 z-10 w-full h-full"
        viewBox="0 0 1920 1080"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <mask id="hero-mask-infinity">
            {/* White background = show black rect */}
            <rect x="0" y="0" width="1920" height="1080" fill="white" />
            {/* Black text = hide black rect (reveal image beneath) */}
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
        {/* Black rect with mask applied - text areas become transparent */}
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
