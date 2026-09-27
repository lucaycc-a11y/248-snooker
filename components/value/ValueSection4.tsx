'use client';

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import '@/app/[locale]/value/value-s4.css';

gsap.registerPlugin(ScrollTrigger);

export default function ValueSection4() {
  const sectionRef = useRef<HTMLElement>(null);
  const rectRef = useRef<SVGRectElement>(null);
  const tweenRef = useRef<gsap.core.Tween | null>(null);

  useEffect(() => {
    console.log('[Level 3] Component mounted');

    if (!sectionRef.current || !rectRef.current) {
      console.log('[Level 3] Missing refs, aborting');
      return;
    }

    // Kill any existing animation on this element
    if (tweenRef.current) {
      tweenRef.current.kill();
      tweenRef.current = null;
    }

    console.log('[Level 3] Setting up GSAP');

    // Set initial scale to 20
    gsap.set(rectRef.current, { scale: 20, transformOrigin: '50% 50%' });
    console.log('[Level 3] Set initial scale to 20');

    // Refresh ScrollTrigger to handle any layout changes
    ScrollTrigger.refresh();

    // Simple scroll-linked scale animation (NO pin yet)
    tweenRef.current = gsap.to(rectRef.current, {
      scale: 1,
      ease: 'none',
      scrollTrigger: {
        trigger: sectionRef.current,
        start: 'top top',
        end: '+=1000',
        scrub: 1,
        markers: true, // Debug markers (will remove in final)
        onUpdate: (self) => console.log('[Level 3] Progress:', self.progress.toFixed(2)),
      },
    });

    console.log('[Level 3] ScrollTrigger created');

    return () => {
      console.log('[Level 3] Cleanup');
      if (tweenRef.current) {
        tweenRef.current.scrollTrigger?.kill();
        tweenRef.current.kill();
        tweenRef.current = null;
      }
    };
  }, []);

  return (
    <>
      <section ref={sectionRef} className="value-s4">
        {/* Layer 1: Photo background */}
        <div className="s4-photo-layer">
          <img
            className="s4-photo s4-photo--table1"
            src="/images/space-infinity-room-中八桌球-香港新蒲崗.webp"
            alt=""
          />
        </div>

        {/* Layer 2: SVG Exclude Mask */}
        <svg
          className="s4-exclude-svg s4-exclude-svg--infinity"
          viewBox="0 0 1512 1123"
          preserveAspectRatio="xMidYMid slice"
        >
          <defs>
            <mask id="s4-mask-infinity">
              {/* White = show black rect, Black text = transparent cutout */}
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
            ref={rectRef}
            className="s4-exclude-rect s4-exclude-rect--infinity"
            x="0"
            y="0"
            width="1512"
            height="1123"
            fill="#000000"
            mask="url(#s4-mask-infinity)"
          />
        </svg>
      </section>

      {/* Spacer to enable scrolling for Level 3 testing */}
      <div style={{ height: '2000px', background: '#111' }} />
    </>
  );
}
