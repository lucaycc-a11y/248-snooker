"use client";

// GSAP ScrollTrigger animations for the SpaceWheelOutro section.
//
// Targets: data-outro-* attributes set in SpaceWheelOutro.tsx.
// All motion is strictly ONE direction — no reverse, no bounce, no rotation.
// Easing: cubic-bezier(.2,.7,.3,1) throughout.
// prefers-reduced-motion: snaps every element to its final state instantly.
import { useEffect } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

// Apple-style ease — fast in, relaxed settle.
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
      section.querySelectorAll<HTMLElement>("*").forEach((el) => {
        el.style.opacity = "";
        el.style.transform = "";
        el.style.visibility = "";
      });
      return;
    }

    const mobile = window.matchMedia("(max-width: 767px)").matches;

    // ── Set initial hidden states ─────────────────────────────────────────────
    // Per-character spans in the headline
    const chars = Array.from(
      section.querySelectorAll<HTMLElement>("[data-outro-char]"),
    );
    const ball = section.querySelector<HTMLElement>("[data-outro-ball-enter]");
    const desc = section.querySelector<HTMLElement>("[data-outro-desc]");
    const steps = Array.from(
      section.querySelectorAll<HTMLElement>("[data-outro-step]"),
    );
    const buttons = section.querySelector<HTMLElement>("[data-outro-buttons]");

    // Hide elements that will be animated in
    gsap.set(chars, { autoAlpha: 0, y: 18 });
    if (ball) gsap.set(ball, { autoAlpha: 0, y: 90, scale: 0.92 });
    if (desc) gsap.set(desc, { autoAlpha: 0, y: 20 });
    gsap.set(steps, { autoAlpha: 0, y: 20 });
    if (buttons) gsap.set(buttons, { autoAlpha: 0, y: 16 });

    // Outer ball scroll wrapper — starts slightly low for parallax
    const ballScroll = section.querySelector<HTMLElement>(
      "[data-outro-ball-scroll]",
    );
    if (ballScroll) gsap.set(ballScroll, { y: 30 });

    const ctx = gsap.context(() => {
      // ── Group A: headline chars + echo ghosts + ball ──────────────────────
      // Triggers when the band top reaches 75% of viewport height.
      const tl = gsap.timeline({
        scrollTrigger: {
          id: "outro-reveal-a",
          trigger: "[data-outro-band]",
          start: "top 75%",
          once: true,
        },
      });

      // 1. Per-character headline stagger
      tl.to(chars, {
        autoAlpha: 1,
        y: 0,
        duration: 0.55,
        ease: EASE,
        stagger: 0.04,
      });

      // 2. Echo ghosts — slide from behind the headline to their resting offsets
      //    and stay there (they are part of the static design, not a transient effect).
      //    Ghost 1: opacity 0→0.9, y 0→0.75em. Ghost 2: opacity 0→0.7, y 0→1.41em.
      const echo1 = section.querySelector<HTMLElement>('[data-outro-echo="1"]');
      const echo2 = section.querySelector<HTMLElement>('[data-outro-echo="2"]');
      if (echo1) gsap.set(echo1, { opacity: 0, y: 0 });
      if (echo2) gsap.set(echo2, { opacity: 0, y: 0 });
      if (echo1) {
        tl.to(
          echo1,
          { opacity: 0.9, y: "0.75em", duration: 0.9, ease: EASE },
          "-=0.45",
        );
      }
      if (echo2) {
        tl.to(
          echo2,
          { opacity: 0.7, y: "1.41em", duration: 0.9, ease: EASE },
          "-=0.75",
        );
      }

      // 3. Ball float-up — starts while headline chars are still landing
      if (ball) {
        tl.to(
          ball,
          {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            duration: 1.0,
            ease: EASE,
          },
          "-=0.6",
        );
      }

      // ── Group B: description → steps → buttons ────────────────────────────
      // Second trigger: slightly later (88% viewport) so content below the
      // fold enters after the ball is mostly settled.
      const tl2 = gsap.timeline({
        scrollTrigger: {
          id: "outro-reveal-b",
          trigger: "[data-outro-band]",
          start: "top 88%",
          once: true,
        },
      });

      // 4. Description block
      if (desc) {
        tl2.to(desc, {
          autoAlpha: 1,
          y: 0,
          duration: 0.6,
          ease: EASE,
        });
      }

      // 5. Steps — staggered left to right
      tl2.to(
        steps,
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.5,
          ease: EASE,
          stagger: 0.09,
        },
        "-=0.25",
      );

      // 6. Buttons
      if (buttons) {
        tl2.to(
          buttons,
          { autoAlpha: 1, y: 0, duration: 0.55, ease: EASE },
          "-=0.15",
        );
      }

      // ── Scroll-linked ball parallax ──────────────────────────────────────
      // Outer wrapper scrubs +30px → −10px as the band passes the viewport.
      if (ballScroll) {
        gsap.fromTo(
          ballScroll,
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
      }

      // ── Headline group parallax (desktop only) ───────────────────────────
      // Headline group scrolls at a slower rate — a subtle depth cue.
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

    // ── will-change cleanup after all animations settle (longest = 1s ball) ──
    const allAnimated = [
      ...chars,
      ...(ball ? [ball] : []),
      ...(desc ? [desc] : []),
      ...steps,
      ...(buttons ? [buttons] : []),
    ];
    allAnimated.forEach((el) => {
      el.style.willChange = "transform, opacity";
    });
    const cleanup = setTimeout(() => {
      allAnimated.forEach((el) => {
        el.style.willChange = "auto";
      });
    }, 2400);

    return () => {
      ctx.revert();
      clearTimeout(cleanup);
    };
  }, []);
}
