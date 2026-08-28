"use client";

import { useEffect, useRef, type MutableRefObject } from "react";
import { animate, onScroll, stagger } from "animejs";

type AnimeRevealOptions = {
  selector?: string;
  duration?: number;
  delay?: number;
  distance?: number;
};

type AnimeRoot = HTMLElement & { dataset: DOMStringMap };

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function showImmediately(targets: HTMLElement[]): void {
  targets.forEach((target) => {
    target.style.opacity = "1";
    target.style.transform = "none";
  });
}

/**
 * Reveal a small, explicitly marked set of elements when their root enters view.
 * The helper deliberately avoids global selectors so pages can safely contain
 * multiple independent animation systems.
 */
export function useAnimeReveal<T extends HTMLElement>(
  options: AnimeRevealOptions = {},
): MutableRefObject<T | null> {
  const rootRef = useRef<T | null>(null);

  useEffect(() => {
    const root = rootRef.current as AnimeRoot | null;
    if (!root) return;

    const targets = options.selector
      ? Array.from(root.querySelectorAll<HTMLElement>(options.selector))
      : [root];
    if (!targets.length) return;

    if (prefersReducedMotion()) {
      showImmediately(targets);
      return;
    }

    const observer = onScroll({
      target: root,
      enter: "top 88%",
      leave: "bottom 12%",
      repeat: false,
    });
    const animation = animate(targets, {
      opacity: [0, 1],
      y: [options.distance ?? 22, 0],
      duration: options.duration ?? 700,
      delay: targets.length > 1 ? stagger(options.delay ?? 70) : 0,
      ease: "outCubic",
      autoplay: observer,
    });

    return () => {
      animation.revert();
      observer.revert();
    };
  }, [options.delay, options.distance, options.duration, options.selector]);

  return rootRef;
}

/** Run a one-shot entrance on mount, suitable for above-the-fold hero content. */
export function useAnimeEntrance<T extends HTMLElement>(
  options: AnimeRevealOptions = {},
): MutableRefObject<T | null> {
  const rootRef = useRef<T | null>(null);

  useEffect(() => {
    const root = rootRef.current as AnimeRoot | null;
    if (!root) return;
    const targets = options.selector
      ? Array.from(root.querySelectorAll<HTMLElement>(options.selector))
      : [root];
    if (!targets.length) return;

    if (prefersReducedMotion()) {
      showImmediately(targets);
      return;
    }

    const animation = animate(targets, {
      opacity: [0, 1],
      y: [options.distance ?? 18, 0],
      duration: options.duration ?? 850,
      delay: targets.length > 1 ? stagger(options.delay ?? 100) : 0,
      ease: "outCubic",
    });

    return () => {
      animation.revert();
    };
  }, [options.delay, options.distance, options.duration, options.selector]);

  return rootRef;
}
