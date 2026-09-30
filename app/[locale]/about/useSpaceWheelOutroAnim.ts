"use client";

// GSAP ScrollTrigger animations for the SpaceWheelOutro section.
//
// Targets: data-outro-* attributes set in SpaceWheelOutro.tsx.
// All motion is strictly ONE direction — no reverse, no bounce, no rotation.
// Easing: cubic-bezier(.2,.7,.3,1) throughout.
// prefers-reduced-motion: jumps every element to its final state, no tweening.
import { useEffect } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

// Apple-style ease used throughout — fast in, relaxed settle.
const EASE = "cubic-bezier(.2,.7,.3,1)";

export function useSpaceWheelOutroAnim() {
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const section = document.querySelector<HTMLElement>(
      "[data-outro-section]",
    );
    if (!section) return;

    // ── prefers-reduced-motion: expose every element immediately ─────────────
    if (reduced) {
      section
        .querySelectorAll<HTMLElement>("[data-outro-section] *")
        .forEach((el) => {
          el.style.opacity = "";
          el.style.transform = "";
        });
      return;
    }

    const mobile = window.matchMedia("(max-width: 767px)").matches;

    // ── Hide elements that will be revealed sequentially ─────────────────────
    // Only hide them after the animation context is live so there's no flash
    // of invisible content if JS is slow.
    const revealTargets = [
      "[data-outro-eyebrow]",
      "[data-outro-headline-1]",
      "[data-outro-headline-2-wrap]",
      "[data-outro-ball-enter]",
      "[data-outro-desc-bold]",
      "[data-outro-desc-grey]",
      "[data-outro-stat]",
      "[data-outro-step]",
      "[data-outro-buttons]",
    ]
      .map((sel) => Array.from(section.querySelectorAll<HTMLElement>(sel)))
      .flat();

    gsap.set(revealTargets, { autoAlpha: 0 });
    gsap.set("[data-outro-ball-enter]", { y: 90, scale: 0.92, autoAlpha: 0 });
    gsap.set("[data-outro-ball-scroll]", { y: 30 });

    const ctx = gsap.context(() => {
      // ── Sequential reveal — Group A (eyebrow → headline 1 → headline 2+echo → ball) ─
      // Triggers when band top passes 75% viewport height.
      const tl = gsap.timeline({
        scrollTrigger: {
          id: "outro-reveal-a",
          trigger: "[data-outro-band]",
          start: "top 75%",
          once: true,
        },
      });

      // 1. Eyebrow
      tl.to("[data-outro-eyebrow]", {
        autoAlpha: 1,
        y: 0,
        duration: 0.65,
        ease: EASE,
      });

      // 2. Headline line 1
      tl.to(
        "[data-outro-headline-1]",
        { autoAlpha: 1, y: 0, duration: 0.65, ease: EASE },
        "-=0.37",
      );

      // 3. Headline line 2 + echo ghosts
      tl.to(
        "[data-outro-headline-2]",
        { autoAlpha: 1, y: 0, duration: 0.65, ease: EASE },
        "-=0.23",
      );

      // Echo ghosts — each trails DOWN to i×0.32em, peaks then fades.
      // One-direction: opacity goes 0 → peak → 0, y goes 0 → i×0.32em only.
      const echoDuration = 0.9;
      [1, 2, 3, 4].forEach((i) => {
        const ghost = section.querySelector<HTMLElement>(
          `[data-outro-echo="${i}"]`,
        );
        if (!ghost) return;
        const peakOpacity = 0.18 / i;
        const yTrail = `${i * 0.32}em`;
        // Stagger: each ghost starts 80ms after the previous.
        const echoStart = `>-=${echoDuration - 0.08 * i}`;
        tl.fromTo(
          ghost,
          { opacity: 0, y: 0 },
          {
            keyframes: [
              { opacity: peakOpacity, y: yTrail, duration: echoDuration * 0.55 },
              { opacity: 0, y: yTrail, duration: echoDuration * 0.45 },
            ],
            ease: EASE,
            duration: echoDuration,
          },
          i === 1 ? "-=0.5" : echoStart,
        );
      });

      // 4. Ball entrance (float-up) — 140ms stagger after headline group
      tl.to(
        "[data-outro-ball-enter]",
        {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          duration: 1.0,
          ease: EASE,
        },
        "-=0.56",
      );

      // ── Sequential reveal — Group B (desc → stats → steps → buttons) ────────
      // Triggers when band top passes 88% viewport height.
      const tl2 = gsap.timeline({
        scrollTrigger: {
          id: "outro-reveal-b",
          trigger: "[data-outro-band]",
          start: "top 88%",
          once: true,
        },
      });

      // 5. Description bold
      tl2.to("[data-outro-desc-bold]", {
        autoAlpha: 1,
        y: 0,
        duration: 0.6,
        ease: EASE,
      });

      // 6. Description grey
      tl2.to(
        "[data-outro-desc-grey]",
        { autoAlpha: 1, y: 0, duration: 0.6, ease: EASE },
        "-=0.28",
      );

      // 7. Stats — staggered
      tl2.to(
        "[data-outro-stat]",
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.55,
          ease: EASE,
          stagger: 0.1,
        },
        "-=0.2",
      );

      // 8. Steps — staggered
      tl2.to(
        "[data-outro-step]",
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.5,
          ease: EASE,
          stagger: 0.08,
        },
        "-=0.15",
      );

      // 9. Buttons
      tl2.to(
        "[data-outro-buttons]",
        { autoAlpha: 1, y: 0, duration: 0.55, ease: EASE },
        "-=0.1",
      );

      // ── Scroll-linked ball parallax ──────────────────────────────────────────
      // Outer wrapper: scrubs +30px → −10px as the band scrolls through viewport.
      gsap.fromTo(
        "[data-outro-ball-scroll]",
        { y: 30 },
        {
          y: -10,
          ease: "none",
          scrollTrigger: {
            id: "outro-ball-scrub",
            trigger: "[data-outro-band]",
            start: "top bottom",
            end: "bottom top",
            scrub: 1.2,
          },
        },
      );

      // ── Headline parallax (desktop only) ────────────────────────────────────
      // Headline group scrolls at 85% of normal speed — a subtle depth cue.
      if (!mobile) {
        gsap.to("[data-outro-headline-group]", {
          yPercent: -6,
          ease: "none",
          scrollTrigger: {
            id: "outro-headline-parallax",
            trigger: "[data-outro-band]",
            start: "top bottom",
            end: "bottom top",
            scrub: true,
          },
        });
      }
    }, section);

    // ── will-change cleanup — remove after all animations settle ─────────────
    // Give the longest animation (ball, 1s) plus a buffer before clearing.
    const willChangeEls = revealTargets;
    willChangeEls.forEach((el) => {
      el.style.willChange = "transform, opacity";
    });
    const cleanup = setTimeout(() => {
      willChangeEls.forEach((el) => {
        el.style.willChange = "auto";
      });
    }, 2400);

    return () => {
      ctx.revert();
      clearTimeout(cleanup);
    };
  }, []);
}
