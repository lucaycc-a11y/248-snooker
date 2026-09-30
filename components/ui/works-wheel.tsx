"use client";

// A portfolio index built as a wheel you turn.
//
// At rest the work sits in a ring around a title, each card tangent to the
// circle. The first notch of scroll blows the ring open into a vertical drum:
// the card at the front lies flat and full size, the ones above and below
// rotate away into hard perspective and run off the top and bottom of the
// frame. Keep turning and the drum carries the next piece round to the front.
//
// The whole thing is one number — `turn` — read by a single rAF pass that
// writes transforms straight to the DOM. 0 is the ring, 1 is the drum with
// item 0 at the front, and every whole number after that is one more item
// turned past.
//
// Input is entirely external: the parent drives `turnRef` (via GSAP
// ScrollTrigger). No wheel-hijack, no pointer drag.
import * as React from "react";

import { cn } from "@/lib/utils";

export interface SpaceWheelItem {
  title: string;
  description: string;
  image: string;
  alt: string;
}

export interface SpaceWheelProps
  extends Omit<React.ComponentPropsWithoutRef<"section">, "children"> {
  items: SpaceWheelItem[];
  /** External turn position driven by the parent (GSAP ScrollTrigger). */
  turnRef: React.MutableRefObject<number>;
  /** Text that sits in the middle of the ring while it is at rest. */
  ringLabel?: React.ReactNode;
  /** Called whenever the active (front) item index changes. */
  onActiveChange?: (index: number) => void;
}

// ─── Geometry ────────────────────────────────────────────────────────────────
// The card is measured against the stage; everything else is measured against
// the card, so a narrow stage scales the whole wheel down with it instead of
// leaving a small card swinging on a huge drum. STEP/DRUM/LENS are tuned
// together: STEP vs DRUM sets how hard neighbours rotate away, DRUM vs LENS
// decides whether they land inside the frame or clip off it.

// Mobile-first: larger cards on phones (~78% stage width), smaller on desktop
const MOBILE_BREAKPOINT = 768;
const CARD_H_MOBILE = 0.52;      // front card height (mobile) as fraction of stage height
const CARD_MAX_W_MOBILE = 0.78;  // max width (mobile) as fraction of stage width
const CARD_H_DESKTOP = 0.38;     // front card height (desktop)
const CARD_MAX_W_DESKTOP = 0.34; // max width (desktop)
const CARD_RATIO = 1.5;          // card width / height (3:2 to match photo ratio)
const STEP = 40;                 // degrees between cards on the drum
const DRUM = 2.22;               // drum radius, in card heights
const LENS = 2.7;                // perspective distance, in card heights
const RING_R = 1.15;             // ring radius, in card heights (adjusted for 3 items in triangle)
// The drum alone would hang items on a plumb line. BOW curves the strip around
// an arc whose centre is off to the LEFT, so the front card sits at the arc's
// near point (dead centre) and neighbours have already swung back as well as
// up/down. Without this it reads as a stack of cards, not a wheel seen side-on.
const BOW = 1.82;
const TITLE = 0.124;  // font size for ring label and front-card title
const INDEX = 0.04;   // font size for the right-hand index column
// Items further than this from the front are culled: past ±CULL a card is
// edge-on and would pile up on the vanishing point.
const CULL = 1.6;

const EASE = 0.12; // fraction of remaining gap closed per frame

// ─── Helpers ─────────────────────────────────────────────────────────────────
const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Lateral offset from the bow arc at `drumDeg` degrees off-front. */
const bowAt = (drumDeg: number, bow: number) =>
  -bow * (1 - Math.cos(rad(drumDeg)));

/**
 * Both states in one transform chain. Ring terms fall away as `m` → 1 (drum),
 * drum terms are zero while the ring is up. The bow slides the card sideways
 * in the wheel's own plane before perspective shrinks it with distance.
 */
function place(
  ringDeg: number,
  drumDeg: number,
  ringR: number,
  drumR: number,
  bow: number,
  m: number,
): string {
  return (
    `translateX(${m * bowAt(drumDeg, bow)}px)` +
    ` rotateZ(${(1 - m) * ringDeg}deg) translateY(${-(1 - m) * ringR}px)` +
    ` rotateX(${m * drumDeg}deg) translateZ(${m * drumR}px)`
  );
}

type Stage = { w: number; h: number };

// ─── Component ───────────────────────────────────────────────────────────────

export function SpaceWheel({
  items,
  turnRef,
  ringLabel,
  onActiveChange,
  className,
  ...props
}: SpaceWheelProps) {
  const stageRef = React.useRef<HTMLDivElement>(null);
  const wheelRef = React.useRef<HTMLDivElement>(null);
  const cardRefs = React.useRef<(HTMLElement | null)[]>([]);
  const labelRef = React.useRef<HTMLDivElement>(null);
  const titleRef = React.useRef<HTMLDivElement>(null);
  const descRef = React.useRef<HTMLDivElement>(null);

  // `active` is the only React state; everything else is written straight to
  // the DOM so the rAF loop never triggers a render.
  const [active, setActive] = React.useState(0);
  const [stage, setStage] = React.useState<Stage>({ w: 0, h: 0 });
  const [isVisible, setIsVisible] = React.useState(false);

  const count = items.length;
  const last = Math.max(count - 1, 0);

  // Read matchMedia after mount — the server has no matchMedia, and reading it
  // inline would be a hydration mismatch.
  const [reduced, setReduced] = React.useState(false);
  React.useEffect(() => {
    const q = window.matchMedia("(prefers-reduced-motion: reduce)");
    const read = () => setReduced(q.matches);
    read();
    q.addEventListener("change", read);
    return () => q.removeEventListener("change", read);
  }, []);

  // IntersectionObserver: pause rAF when off-screen for performance
  React.useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => setIsVisible(entries[0]?.isIntersecting ?? false),
      { threshold: 0.1 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  React.useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const read = () => setStage({ w: el.clientWidth, h: el.clientHeight });
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const metrics = React.useMemo(() => {
    const { w, h } = stage;
    const isMobile = w <= MOBILE_BREAKPOINT;
    const cardH_base = isMobile ? CARD_H_MOBILE : CARD_H_DESKTOP;
    const cardMaxW_base = isMobile ? CARD_MAX_W_MOBILE : CARD_MAX_W_DESKTOP;
    const cardW = Math.min(h * cardH_base * CARD_RATIO, w * cardMaxW_base);
    const cardH = cardW / CARD_RATIO;
    const drumR = cardH * DRUM;
    const ringR = cardH * RING_R;
    // Shrink ring cards until the circle reads as a closed loop rather than
    // beads on a wire, regardless of item count.
    const ringScale = count
      ? clamp((((2 * Math.PI * ringR) / count) * 0.82) / (cardW || 1), 0.16, 1)
      : 1;
    return {
      cardW,
      cardH,
      ringR,
      ringScale,
      drumR,
      bow: cardH * BOW,
      depth: cardH * LENS,
      title: cardH * TITLE,
      index: cardH * INDEX,
      isMobile,
    };
  }, [stage, count]);

  // Internal smooth position — eased toward whatever turnRef holds.
  const smooth = React.useRef(0);

  React.useEffect(() => {
    if (!stage.h || !isVisible) return;
    let frame = 0;
    const { ringR, ringScale, drumR, bow } = metrics;

    const draw = () => {
      frame = requestAnimationFrame(draw);

      const target = clamp(turnRef.current, 0, last + 1);
      const gap = target - smooth.current;
      if (Math.abs(gap) < 0.0005) smooth.current = target;
      else smooth.current += gap * (reduced ? 1 : EASE);

      const t = smooth.current;
      const m = clamp(t, 0, 1);
      const pos = Math.max(0, t - 1);

      // Pull the drum back so its front face lands on the picture plane;
      // the set-back must arrive with the drum or the ring would sit far
      // behind the perspective origin and appear at half size.
      if (wheelRef.current) {
        wheelRef.current.style.transform = `translateZ(${-m * drumR}px)`;
      }

      for (let i = 0; i < count; i++) {
        const d = i - pos;
        const drumDeg = d * STEP;
        const card = cardRefs.current[i];
        if (card) {
          card.style.transform = place(
            d * (360 / count),
            drumDeg,
            ringR,
            drumR,
            bow,
            m,
          );
          const cardOpacity = m > 0.5 && Math.abs(d) > CULL ? 0 : 1;
          card.style.opacity = String(cardOpacity);
          card.style.zIndex = String(Math.round(100 - Math.abs(d) * 2));
          // Performance hint: only animate cards that are visible
          card.style.willChange = cardOpacity > 0.1 ? 'transform' : 'auto';
        }
        const face = card?.firstElementChild as HTMLElement | null;
        if (face) face.style.transform = `scale(${lerp(ringScale, 1, m)})`;
      }

      if (labelRef.current) labelRef.current.style.opacity = String(1 - m);
      if (titleRef.current) titleRef.current.style.opacity = String(m);
      if (descRef.current) descRef.current.style.opacity = String(m);

      const near = clamp(Math.round(pos), 0, last);
      setActive((prev) => {
        if (prev !== near) onActiveChange?.(near);
        return prev === near ? prev : near;
      });
    };

    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [metrics, stage.h, count, last, reduced, turnRef, onActiveChange, isVisible]);

  // Keyboard navigation — ArrowUp/Down move through items.
  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "ArrowDown") {
        turnRef.current = clamp(Math.round(turnRef.current) + 1, 0, last + 1);
      } else if (event.key === "ArrowUp") {
        turnRef.current = clamp(Math.round(turnRef.current) - 1, 0, last + 1);
      } else {
        return;
      }
      event.preventDefault();
    },
    [turnRef, last],
  );

  const activeItem = items[active];

  return (
    <section
      aria-label="Space8 場地相片"
      className={cn(
        "relative h-full min-h-[24rem] w-full overflow-hidden select-none",
        className,
      )}
      style={{ backgroundColor: "#ffffff" }}
      {...props}
    >
      {/* ── Stage ── */}
      <div
        ref={stageRef}
        tabIndex={0}
        role="listbox"
        aria-label="Space8 場地相片"
        aria-activedescendant={`space-wheel-item-${active}`}
        className="absolute inset-0 outline-none focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-white/40"
        style={{ perspective: `${metrics.depth}px` }}
        onKeyDown={handleKeyDown}
      >
        {/* ── Wheel hub ── */}
        <div
          ref={wheelRef}
          className="absolute top-1/2 left-1/2 [transform-style:preserve-3d]"
        >
          {items.map((item, i) => (
            <div
              key={item.title}
              id={`space-wheel-item-${i}`}
              role="option"
              aria-selected={i === active}
              ref={(node) => { cardRefs.current[i] = node; }}
              className="absolute [backface-visibility:hidden]"
              style={{
                width: metrics.cardW,
                height: metrics.cardH,
                marginLeft: -metrics.cardW / 2,
                marginTop: -metrics.cardH / 2,
              }}
            >
              {/* Card face — 1 px border rgba(0,0,0,0.08) for white bg */}
              <span
                className="relative block size-full overflow-hidden rounded-lg"
                style={{ border: "1px solid rgba(0,0,0,0.08)" }}
              >
                <img
                  src={item.image}
                  alt={item.alt}
                  draggable={false}
                  className="size-full object-cover"
                />
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Ring centre label (fades out as drum opens) ── */}
      <div
        ref={labelRef}
        className="pointer-events-none absolute inset-0 grid place-items-center"
        style={{ fontSize: metrics.title }}
      >
        {ringLabel}
      </div>

      {/* ── Mobile text scrim (gradient below front card) ── */}
      {metrics.isMobile && (
        <div
          ref={titleRef}
          className="pointer-events-none absolute left-0 right-0 opacity-0 flex flex-col items-center text-center px-6"
          style={{
            top: "58%",
            background: "linear-gradient(to bottom, rgba(255,255,255,0) 0%, #ffffff 45%)",
            paddingTop: "2rem",
            paddingBottom: "1.5rem",
          }}
        >
          <p
            className="font-semibold leading-snug"
            style={{ fontFamily: "'Noto Sans TC', sans-serif", fontSize: metrics.title * 0.85, color: "#000000" }}
          >
            {activeItem?.title}
          </p>
          <p
            className="leading-relaxed max-w-[85%]"
            style={{ fontFamily: "'Noto Sans TC', sans-serif", fontWeight: 600, fontSize: metrics.index * 1.1, color: "rgba(0,0,0,0.6)" }}
          >
            {activeItem?.description}
          </p>
        </div>
      )}

      {/* ── Desktop text (left of card) ── */}
      {!metrics.isMobile && (
        <>
          <div
            ref={titleRef}
            className="pointer-events-none absolute top-1/2 left-[8%] -translate-y-1/2 opacity-0 max-w-[28%]"
            style={{ fontSize: metrics.title }}
          >
            <p
              className="font-semibold leading-snug"
              style={{ fontFamily: "'Noto Sans TC', sans-serif", color: "#000000" }}
            >
              {activeItem?.title}
            </p>
          </div>
          <div
            ref={descRef}
            className="pointer-events-none absolute bottom-[12%] left-[8%] opacity-0 max-w-[36%]"
            style={{ fontSize: metrics.index * 1.1 }}
          >
            <p
              className="leading-relaxed"
              style={{ fontFamily: "'Noto Sans TC', sans-serif", fontWeight: 600, color: "rgba(0,0,0,0.6)" }}
            >
              {activeItem?.description}
            </p>
          </div>
        </>
      )}

      {/* ── Progress indicator: mobile thin line + "01/03", desktop vertical index ── */}
      {metrics.isMobile ? (
        <div
          ref={descRef}
          className="pointer-events-none absolute top-[6%] left-1/2 -translate-x-1/2 opacity-0 flex flex-col items-center gap-2"
        >
          <div className="flex items-center gap-1">
            {items.map((_, i) => (
              <div
                key={i}
                className="transition-all duration-300"
                style={{
                  width: i === active ? 24 : 6,
                  height: 2,
                  backgroundColor: i === active ? "#22c55e" : "rgba(0,0,0,0.2)",
                  borderRadius: 1,
                }}
              />
            ))}
          </div>
          <p
            style={{ fontFamily: "'Good Times', monospace", fontSize: metrics.index * 0.9, color: "rgba(0,0,0,0.6)" }}
          >
            {String(active + 1).padStart(2, "0")} / {String(count).padStart(2, "0")}
          </p>
        </div>
      ) : (
        <ol
          className="absolute top-[7.5%] right-[2.5%] text-right leading-[1.75]"
          style={{ fontSize: metrics.index }}
          aria-hidden="true"
        >
          {items.map((item, i) => (
            <li key={item.title}>
              <span
                className="block transition-colors duration-300"
                style={{
                  fontFamily: "'Good Times', monospace",
                  color: i === active ? "#000000" : "rgba(0,0,0,0.45)",
                  fontWeight: i === active ? 600 : 400,
                }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export default SpaceWheel;
