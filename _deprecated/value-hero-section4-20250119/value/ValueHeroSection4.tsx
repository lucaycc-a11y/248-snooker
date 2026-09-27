'use client';

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import './ValueHeroSection4.module.css';

gsap.registerPlugin(ScrollTrigger);

interface TargetCoords {
  xPercent: number;
  yPercent: number;
}

interface Config {
  desktop: {
    infinity: TargetCoords;
    eternity: TargetCoords;
  };
  mobile: {
    infinity: TargetCoords;
    eternity: TargetCoords;
  };
}

const VALUE_SECTION4_CONFIG = {
  designWidth: 1512,
  designHeight: 1123,
  mobileViewBox: { width: 750, height: 1334 },
  font: { family: 'Good Times', weight: 400, sizeAtDesignWidth: 128 },
  metallicGradient: `linear-gradient(90.128deg, rgb(124,120,120) 2.6068%, rgb(221,221,221) 41.449%, rgb(210,210,210) 62.509%, rgb(124,120,120) 99.947%)`,
  darkGreyColor: '#4a4a4a',
  orColor: '#ffffff',
  eternityPreMaskColor: '#9a9a9a',
  part2ZoomStart: 198,
  part7ZoomEnd: 794,
  target: {
    desktop: {
      infinity: { xPercent: -12, yPercent: 0 },
      eternity: { xPercent: -45, yPercent: 0 }
    },
    mobile: {
      infinity: { xPercent: -15, yPercent: 0 },
      eternity: { xPercent: -48, yPercent: 0 }
    },
  } as Config,
  scrollDistance: {
    desktop: 6000,
    mobile: 3200,
  },
  scrubSeconds: 1,
};

export default function ValueHeroSection4() {
  const sectionRef = useRef<HTMLElement>(null);
  const infinityTitleRef = useRef<HTMLHeadingElement>(null);
  const eternityTitleRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      mm.add(
        {
          isDesktop: '(min-width: 1024px)',
          isMobile: '(max-width: 1023px)',
        },
        (context) => {
          const { isMobile } = context.conditions as { isMobile?: boolean };
          const config = VALUE_SECTION4_CONFIG;
          const TARGET = isMobile ? config.target.mobile : config.target.desktop;
          const scrollEnd = isMobile ? config.scrollDistance.mobile : config.scrollDistance.desktop;

          const tl = gsap.timeline({
            scrollTrigger: {
              trigger: '.value-s4',
              start: 'top top',
              end: `+=${scrollEnd}`,
              scrub: config.scrubSeconds,
              pin: true,
              invalidateOnRefresh: true,
              // markers: true, // Debug only
            },
          });

          // Part 2 → 3: Giant zoom shrinks to normal, revealing "SPACE INFINITY" cutout
          tl.addLabel('part2-start')
            .fromTo(
              '.s4-exclude-rect--infinity',
              {
                scale: config.part2ZoomStart,
                xPercent: TARGET.infinity.xPercent,
                yPercent: TARGET.infinity.yPercent,
              },
              {
                scale: 1,
                xPercent: 0,
                yPercent: 0,
                duration: 2,
                ease: 'none',
              }
            )
            .to('.s4-title--infinity', { opacity: 1, duration: 0.5 }, '<')
            .addLabel('part3-end');

          // Part 3 → 4: Dark grey crossfades to metallic
          tl.addLabel('part4-start')
            .to('.s4-exclude-svg--infinity', { opacity: 0, duration: 1 })
            .to(
              '.s4-title--infinity',
              {
                duration: 1,
                onStart: () => {
                  infinityTitleRef.current?.classList.add('is-metallic');
                },
              },
              '<'
            )
            .addLabel('part4-end');

          // Part 5: "OR SPACE ETERNITY" fades in
          tl.addLabel('part5-start')
            .to('.s4-subtitle-row', { opacity: 1, y: 0, duration: 1, ease: 'none' }, 'part4-end')
            .addLabel('part5-end');

          // Part 6: "Eternity" becomes cutout
          tl.addLabel('part6-start')
            .set('.s4-photo--table2', { opacity: 0 })
            .to('.s4-title--eternity', { opacity: 0, duration: 0.5 })
            .to('.s4-exclude-svg--eternity', { opacity: 1, duration: 0.5 }, '<')
            .to(
              '.s4-title--eternity',
              {
                duration: 0,
                onStart: () => {
                  eternityTitleRef.current?.classList.add('is-metallic');
                },
              },
              '<'
            )
            .addLabel('part6-end');

          // Part 7: Zoom to "E", revealing Table 2
          tl.addLabel('part7-start')
            .to('.s4-exclude-rect--eternity', {
              scale: config.part7ZoomEnd,
              xPercent: TARGET.eternity.xPercent,
              yPercent: TARGET.eternity.yPercent,
              duration: 3,
              ease: 'none',
              onStart: () => {
                document.querySelector<HTMLElement>('.s4-exclude-rect--eternity')?.style.setProperty('will-change', 'transform');
              },
              onComplete: () => {
                document.querySelector<HTMLElement>('.s4-exclude-rect--eternity')?.style.removeProperty('will-change');
              },
            })
            .to('.s4-photo--table1', { opacity: 0, duration: 1 }, '<')
            .to('.s4-photo--table2', { opacity: 1, duration: 1 }, '<')
            .addLabel('part7-end');
        }
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section className="value-s4" ref={sectionRef}>
      {/* Layer 1: Photo backgrounds */}
      <div className="s4-photo-layer">
        <img
          className="s4-photo s4-photo--table1"
          src="/images/pool-table-closeup-中八桌球-香港新蒲崗.webp"
          alt=""
        />
        <img
          className="s4-photo s4-photo--table2"
          src="/images/pool-table-closeup-2-中八桌球-香港新蒲崗.webp"
          alt=""
        />
      </div>

      {/* Layer 2: Exclude masks (SVG) */}
      <svg
        className="s4-exclude-svg s4-exclude-svg--infinity"
        viewBox="0 0 1512 1123"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <mask id="s4-mask-infinity">
            <rect x="0" y="0" width="1512" height="1123" fill="white" />
            <text
              x="756"
              y="562"
              dy="0.35em"
              textAnchor="middle"
              fontFamily="Good Times"
              fontWeight="400"
              fontSize="128"
              fill="black"
            >
              SPACE INFINITY
            </text>
          </mask>
        </defs>
        <rect
          className="s4-exclude-rect s4-exclude-rect--infinity"
          x="0"
          y="0"
          width="1512"
          height="1123"
          fill="#000000"
          mask="url(#s4-mask-infinity)"
        />
      </svg>

      <svg
        className="s4-exclude-svg s4-exclude-svg--eternity"
        viewBox="0 0 1512 1123"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <mask id="s4-mask-eternity">
            <rect x="0" y="0" width="1512" height="1123" fill="white" />
            <text
              x="756"
              y="562"
              dy="0.35em"
              textAnchor="middle"
              fontFamily="Good Times"
              fontWeight="400"
              fontSize="96"
              fill="black"
            >
              SPACE ETERNITY
            </text>
          </mask>
        </defs>
        <rect
          className="s4-exclude-rect s4-exclude-rect--eternity"
          x="0"
          y="0"
          width="1512"
          height="1123"
          fill="#000000"
          mask="url(#s4-mask-eternity)"
        />
      </svg>

      {/* Layer 3: Text overlays */}
      <div className="s4-text-layer">
        <h2 className="s4-title s4-title--infinity" ref={infinityTitleRef}>
          SPACE INFINITY
        </h2>
        <div className="s4-subtitle-row">
          <span className="s4-or">OR</span>
          <span className="s4-title s4-title--eternity" ref={eternityTitleRef}>
            SPACE ETERNITY
          </span>
        </div>
      </div>
    </section>
  );
}
