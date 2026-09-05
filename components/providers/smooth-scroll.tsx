"use client";

import { useEffect, type PropsWithChildren } from "react";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export default function SmoothScroll({ children }: PropsWithChildren) {
  useEffect(() => {
    const lenis = new Lenis({
      lerp: 0.12,
      smoothWheel: true,
      wheelMultiplier: 1.2,
      touchMultiplier: 2,
      infinite: false,
    });

    const onScroll = (): void => {
      ScrollTrigger.update();
    };
    const refresh = (): void => {
      ScrollTrigger.refresh();
    };

    lenis.on("scroll", onScroll);
    gsap.ticker.add(lenis.raf);
    gsap.ticker.lagSmoothing(0);

    void document.fonts.ready.then(refresh);
    window.addEventListener("load", refresh, { once: true });

    return () => {
      window.removeEventListener("load", refresh);
      lenis.off("scroll", onScroll);
      gsap.ticker.remove(lenis.raf);
      lenis.destroy();
    };
  }, []);

  return children;
}
