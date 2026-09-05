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
    document.documentElement.classList.remove("no-js");
    document.documentElement.classList.add("js");
    const root = rootRef.current as AnimeRoot | null;
    if (!root) return;

    const targets = options.selector
      ? Array.from(root.querySelectorAll<HTMLElement>(options.selector))
      : [root];
    if (!targets.length) return;

    const wrappers = targets.map((target) => {
      const wrapper = document.createElement("div");
      wrapper.className = "anime-reveal-wrapper";
      target.parentNode?.insertBefore(wrapper, target);
      wrapper.appendChild(target);
      return wrapper;
    });

    if (prefersReducedMotion()) {
      showImmediately(wrappers);
      return;
    }

    const observer = onScroll({
      target: root,
      enter: "top 88%",
      leave: "bottom 12%",
      repeat: false,
    });
    const animation = animate(wrappers, {
      opacity: [0, 1],
      y: [options.distance ?? 22, 0],
      duration: options.duration ?? 700,
      delay: wrappers.length > 1 ? stagger(options.delay ?? 70) : 0,
      ease: "outCubic",
      autoplay: observer,
    });

    return () => {
      animation.cancel();
      observer.revert();
      wrappers.forEach((wrapper) => {
        const target = wrapper.firstElementChild;
        if (target) wrapper.parentNode?.insertBefore(target, wrapper);
        wrapper.remove();
      });
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
    document.documentElement.classList.remove("no-js");
    document.documentElement.classList.add("js");
    const root = rootRef.current as AnimeRoot | null;
    if (!root) return;
    const targets = options.selector
      ? Array.from(root.querySelectorAll<HTMLElement>(options.selector))
      : [root];
    if (!targets.length) return;

    targets.forEach((target) => target.classList.add("anime-reveal-target"));

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
      animation.cancel(); // cancel() stops without reverting — leaves current values intact
    };
  }, [options.delay, options.distance, options.duration, options.selector]);

  return rootRef;
}
