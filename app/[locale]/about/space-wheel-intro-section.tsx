"use client";

// About hero: a ring of all 8 About photos around the heading, with the
// description and buttons below it. Scrolling hands the ring off to the
// 3-point carousel in SpaceWheel (same DOM nodes for the 3 carousel photos),
// then the carousel runs exactly as before.
//
//   <runway>          — 510svh: 110svh intro + the carousel's original 400svh
//     <sticky stage>  — 100svh, pinned by GSAP as before
//       <SpaceWheel intro>   — ring → drum, driven by turnRef
//       <hero text>          — description + buttons, fades out over t 0–0.2
//
// Native scrolling only: GSAP ScrollTrigger maps scroll → turnRef, nothing
// listens to wheel/touch/pointer.
import * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Image from "next/image";

import { Link } from "@/i18n/navigation";
import { tokens } from "@/app/styles/tokens";
import {
  SpaceWheel,
  introTextFade,
  introTravel,
  type SpaceWheelIntro,
  type SpaceWheelItem,
} from "@/components/ui/works-wheel";
import manifest from "@/public/images/space8-about-photos/manifest.json";

import { fitHero, type HeroLayout } from "./about-hero-layout";

gsap.registerPlugin(ScrollTrigger);

// ─── Photos and ring slots ───────────────────────────────────────────────────
// The ring keeps the reference order (manifest 01→08 clockwise, 45° apart),
// rotated so 01 sits at 135°: of the 8 rotations this gives the 3 carousel
// photos the shortest total path to their state-01 positions.
const RING_START = 135;
const slotOf = (manifestIndex: number) => (RING_START + 45 * manifestIndex) % 360;

const DRUM_PHOTO_INDICES = [0, 3, 5]; // about-01, about-04, about-06 (unchanged)
const EXTRA_PHOTO_INDICES = [1, 2, 4, 6, 7];

const toItem = (idx: number): SpaceWheelItem => {
  const item = manifest.items[idx];
  return {
    title: item.title,
    description: item.description,
    image: `/images/space8-about-photos/${item.file.replace(/\.jpg$/, ".webp")}`,
    alt: item.alt,
  };
};

const DRUM_ITEMS = DRUM_PHOTO_INDICES.map(toItem);
const EXTRA_ITEMS = EXTRA_PHOTO_INDICES.map(toItem);
const ITEM_SLOTS = DRUM_PHOTO_INDICES.map(slotOf);
const EXTRA_SLOTS = EXTRA_PHOTO_INDICES.map(slotOf);

// Scroll lengths in viewport heights. The carousel keeps its original
// 1 turn per 100svh; the intro replaces its 0→1 ring opening.
const INTRO_LENGTH = 1.1;
const CAROUSEL_TURNS = DRUM_ITEMS.length; // turn 1 → 4, as before
const RUNWAY = INTRO_LENGTH + CAROUSEL_TURNS + 1; // + the pinned 100svh stage

const STATIC_WORD = "純粹玩樂";
const WORD_MS = 2500;
const FONT = "'Noto Sans TC', sans-serif";
const EDGE_FADE =
  "linear-gradient(to bottom, transparent 0, #000 28px, #000 calc(100% - 28px), transparent 100%)";

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

// ─── Heading inside the ring ─────────────────────────────────────────────────

function HeroHeading({ layout, paused }: { layout: HeroLayout | null; paused: boolean }) {
  const t = useTranslations("aboutPage");
  const raw: unknown = t.raw("hero_rotating_words");
  const words = isStringArray(raw) && raw.length > 0 ? raw : [STATIC_WORD];
  const [idx, setIdx] = useState(0);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const q = window.matchMedia("(prefers-reduced-motion: reduce)");
    const read = () => setReduced(q.matches);
    read();
    q.addEventListener("change", read);
    return () => q.removeEventListener("change", read);
  }, []);

  useEffect(() => {
    if (reduced || paused) return;
    const id = setInterval(() => setIdx((i) => (i + 1) % words.length), WORD_MS);
    return () => clearInterval(id);
  }, [reduced, paused, words.length]);

  const staticIdx = Math.max(0, words.indexOf(STATIC_WORD));
  const active = reduced ? staticIdx : idx;

  return (
    <div className="flex flex-col items-center text-center select-none" style={{ gap: 12 }}>
      {layout?.showLogo !== false && (
        <Image
          src="/logos/logo-black-horizontal.svg"
          alt="SPACE8"
          width={108}
          height={28}
          style={{ height: 28, width: "auto" }}
          priority
        />
      )}
      <h1
        className="whitespace-nowrap"
        style={{
          fontFamily: FONT,
          fontWeight: 600,
          fontSize: layout ? layout.headingSize : "clamp(18px, 3.4svh, 32px)",
          lineHeight: 1.3,
          color: "#000000",
          margin: 0,
        }}
      >
        <span data-cms-key="aboutPage.hero_prefix">{t("hero_prefix")}</span>
        {/* Every word sits in one grid cell, so the widest one reserves the width. */}
        <span className="inline-grid align-bottom" style={{ margin: "0 0.25em" }}>
          {words.map((w, i) => (
            <span
              key={w}
              aria-hidden={i !== active}
              className="transition-opacity duration-300 motion-reduce:transition-none"
              style={{ gridArea: "1 / 1", opacity: i === active ? 1 : 0, color: tokens.colors.link }}
            >
              {w}
            </span>
          ))}
        </span>
        <span data-cms-key="aboutPage.hero_suffix">{t("hero_suffix")}</span>
        {/* Visually hidden: gives the h1 venue/中式桌球 context for search & AT. */}
        <span className="sr-only" data-cms-key="aboutPage.h1_seo">{t("h1_seo")}</span>
      </h1>
    </div>
  );
}

// ─── Description + buttons below the ring ────────────────────────────────────

const HeroText = React.forwardRef<
  HTMLDivElement,
  { layout: HeroLayout | null; descRef: React.Ref<HTMLParagraphElement> }
>(function HeroText({ layout, descRef }, ref) {
  const t = useTranslations("aboutPage");
  const full = t("hero_description_full");
  const cut = full.indexOf("。") + 1;
  const lead = cut > 0 ? full.slice(0, cut) : full;
  const rest = cut > 0 ? full.slice(cut) : "";
  const button: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    minWidth: 44,
    padding: "0 24px",
    borderRadius: tokens.radius.button,
    fontFamily: FONT,
    fontWeight: 700,
    fontSize: 15,
    textDecoration: "none",
  };

  return (
    <div
      ref={ref}
      className="absolute inset-x-0 flex flex-col items-center px-6 text-center"
      style={{ top: layout ? layout.textTop : "72%", gap: 16, zIndex: 20 }}
    >
      <p
        ref={descRef}
        data-cms-key="aboutPage.hero_description_full"
        className="[text-wrap:balance]"
        style={{
          fontFamily: FONT,
          fontSize: layout?.descSize ?? 16,
          lineHeight: 1.6,
          maxWidth: "30em",
          color: "#000000",
          margin: 0,
        }}
      >
        <strong style={{ fontWeight: 700 }}>{lead}</strong>
        {rest}
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link
          href="/book"
          data-cms-key="aboutPage.hero_cta_primary"
          style={{ ...button, background: tokens.colors.brand, color: tokens.colors.brandText }}
        >
          {t("hero_cta_primary")}
        </Link>
        <Link
          href="/venue"
          data-cms-key="aboutPage.hero_cta_secondary"
          style={{ ...button, background: "transparent", color: "#000000", border: "1px solid #000000" }}
        >
          {t("hero_cta_secondary")}
        </Link>
      </div>
    </div>
  );
});

// ─── Section ─────────────────────────────────────────────────────────────────

export function SpaceWheelIntroSection() {
  const runwayRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const descRef = useRef<HTMLParagraphElement>(null);
  // GSAP writes to this ref; SpaceWheel's rAF loop reads it.
  const turnRef = useRef(0);
  const [layout, setLayout] = useState<HeroLayout | null>(null);
  const layoutRef = useRef<HeroLayout | null>(null);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const hiddenRef = useRef(false);
  const overlayRefs = useRef<(HTMLDivElement | null)[]>([]);
  // Set after a restored-scroll resync: SpaceWheel snaps to turnRef once
  // instead of easing up to it from the ring.
  const jumpRef = useRef(false);

  // Scroll → turn: 0→1 over the 110svh intro, then 1→4 at the carousel's
  // original 1 turn per 100svh. Same trigger, scrub and pin as before.
  useEffect(() => {
    const runway = runwayRef.current;
    const stage = stageRef.current;
    if (!runway || !stage) return;
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: runway,
        start: "top top",
        end: "bottom bottom",
        scrub: 0.6,
        pin: stage,
        pinSpacing: false,
      },
    });
    tl.to(turnRef, { current: 1, ease: "none", duration: INTRO_LENGTH }).to(turnRef, {
      current: CAROUSEL_TURNS + 1,
      ease: "none",
      duration: CAROUSEL_TURNS,
    });
    // On reload the browser restores the scroll position after this effect
    // has run, so the pin is computed for scrollY 0 and the stage is fixed
    // off-screen. Re-measure once the position is restored; jump the turn
    // there too so the right state shows with no ring flash.
    const resync = () => {
      ScrollTrigger.refresh();
      const st = tl.scrollTrigger;
      if (!st) return;
      // Skip the scrub catch-up: start the timeline at the restored position.
      tl.progress(st.progress);
      turnRef.current = Number(gsap.getProperty(turnRef, "current")) || turnRef.current;
      jumpRef.current = true;
    };
    const raf = requestAnimationFrame(resync);
    window.addEventListener("load", resync, { once: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("load", resync);
      tl.kill();
      ScrollTrigger.getAll().forEach((st) => {
        if (st.trigger === runway) st.kill();
      });
    };
  }, []);

  // Fit the composition to the stage (resize, font load, description wrap).
  useEffect(() => {
    const stage = stageRef.current;
    const text = textRef.current;
    const desc = descRef.current;
    if (!stage || !text || !desc) return;
    const measure = () => {
      const nav = document.querySelector<HTMLElement>(".nav-bar");
      // offsetTop/Height ignore the nav's scroll-scale transform.
      const navBottom = nav ? nav.offsetTop + nav.offsetHeight : 64;
      const next = fitHero({
        stageW: stage.clientWidth,
        stageH: stage.clientHeight,
        navBottom,
        textH: text.offsetHeight,
        descH: desc.offsetHeight,
        descSize: layoutRef.current?.descSize ?? 16,
      });
      const prev = layoutRef.current;
      if (
        prev &&
        Math.abs(prev.r - next.r) < 0.5 &&
        Math.abs(prev.offsetY - next.offsetY) < 0.5 &&
        Math.abs(prev.textTop - next.textTop) < 0.5 &&
        prev.descSize === next.descSize &&
        prev.headingSize === next.headingSize &&
        prev.showLogo === next.showLogo
      ) {
        return;
      }
      if (next.overflow) {
        console.warn("[about-hero] does not fit", stage.clientWidth, stage.clientHeight, next);
      }
      layoutRef.current = next;
      setLayout(next);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(stage);
    ro.observe(text);
    return () => ro.disconnect();
  }, []);

  // Per frame from SpaceWheel: fade the text block, make it inert once gone,
  // and pause the word rotation while scrolled. DOM writes only.
  const onFrame = useCallback((t: number) => {
    const el = textRef.current;
    if (el) {
      const out = introTextFade(t);
      el.style.opacity = String(1 - out);
      el.style.translate = `0 ${-out * 24}px`;
      const hidden = out >= 1;
      if (hidden !== hiddenRef.current) {
        hiddenRef.current = hidden;
        el.inert = hidden;
        el.style.visibility = hidden ? "hidden" : "visible";
      }
    }
    const overlay = String(introTravel(t));
    for (const o of overlayRefs.current) if (o) o.style.opacity = overlay;
    const scrolling = t > 0.005;
    if (scrolling !== pausedRef.current) {
      pausedRef.current = scrolling;
      setPaused(scrolling);
    }
  }, []);

  const intro = useMemo<SpaceWheelIntro>(
    () => ({
      extras: EXTRA_ITEMS,
      itemSlots: ITEM_SLOTS,
      extraSlots: EXTRA_SLOTS,
      geometry: layout ? { offsetY: layout.offsetY, r: layout.r, cardW: layout.cardW } : null,
      onFrame,
      jumpRef,
    }),
    [layout, onFrame],
  );

  return (
    <div
      ref={runwayRef}
      // overflow-anchor: none — the hero text is re-positioned after the first
      // measure; without this Chrome's scroll anchoring "corrects" a restored
      // scroll position by that shift on reload.
      style={{ height: `${RUNWAY * 100}svh`, background: "#ffffff", overflowAnchor: "none" }}
      className="relative"
    >
      <div
        ref={stageRef}
        className="sticky top-0 w-full h-[100svh] overflow-hidden"
        style={{ backgroundColor: "#ffffff", maskImage: EDGE_FADE, WebkitMaskImage: EDGE_FADE }}
        data-hero-fit={layout ? layout.fallbacks.join(",") || "none" : undefined}
      >
        <SpaceWheel
          items={DRUM_ITEMS}
          turnRef={turnRef}
          intro={intro}
          className="absolute inset-0"
          ringLabel={<HeroHeading layout={layout} paused={paused} />}
        />

        <HeroText ref={textRef} layout={layout} descRef={descRef} />

        {/* The carousel's top/bottom fade overlays. They would wash out the
            ring's lower photos, so they fade in with the hand-off and are
            fully present from state 01 on, as before. */}
        <div
          ref={(n) => { overlayRefs.current[0] = n; }}
          className="pointer-events-none absolute top-0 left-0 right-0 z-10"
          style={{
            height: "10%",
            opacity: 0,
            background: "linear-gradient(to bottom, #ffffff, rgba(255,255,255,0))",
          }}
        />
        <div
          ref={(n) => { overlayRefs.current[1] = n; }}
          className="pointer-events-none absolute bottom-0 left-0 right-0 z-10"
          style={{
            height: "22%",
            opacity: 0,
            background: "linear-gradient(to bottom, rgba(255,255,255,0), #ffffff)",
          }}
        />
      </div>
    </div>
  );
}

export default SpaceWheelIntroSection;
