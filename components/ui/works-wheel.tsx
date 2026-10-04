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
  /** If set, this item is a point card in the drum. 0-based index. Items without this field are ring-only. */
  point?: number;
  /** CSS object-position for focal point within the image. Default "center". */
  focalPoint?: string;
}

export interface SpaceWheelProps
  extends Omit<React.ComponentPropsWithoutRef<"section">, "children"> {
  items: SpaceWheelItem[];
  /** External turn position driven by the parent (GSAP ScrollTrigger). */
  turnRef: React.MutableRefObject<number>;
  /** Text that sits in the middle of the ring while it is at rest. */
  label?: React.ReactNode;
  /** @deprecated Use `label` instead. */
  ringLabel?: React.ReactNode;
  /** Called whenever the active (front) item index changes (point index only). */
  onActiveChange?: (index: number) => void;
  /** Rotation tilt for ring cards: 0 = upright, 1 = tangent (default). */
  ringTilt?: number;
  /** Custom index label renderer. Receives the point index (0-based). */
  indexLabel?: (pointIndex: number) => React.ReactNode;
  /** Ring outer diameter as fraction of stage height (default: from cardH × RING_R × 2). About: 0.73 */
  ringOuterRatio?: number;
  /** Ring card width as fraction of ring outer diameter (default: from CARD_RATIO + CARD_H_DESKTOP). About: 0.24 */
  ringCardWidthRatio?: number;
  /** Nav bar height in pixels, subtracted from 100svh to get stage height (default: 64px for About). */
  navHeight?: number;
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
 *
 * `ringTilt` (0-1): 0 = upright on ring, 1 = tangent (default). Counter-rotate
 * the card face by -(1 - m) * ringDeg * (1 - ringTilt).
 */
function place(
  ringDeg: number,
  drumDeg: number,
  ringR: number,
  drumR: number,
  bow: number,
  m: number,
  ringTilt: number = 1,
): string {
  const faceCounterRotate = -(1 - m) * ringDeg * (1 - ringTilt);
  return (
    `translateX(${m * bowAt(drumDeg, bow)}px)` +
    ` rotateZ(${(1 - m) * ringDeg}deg) translateY(${-(1 - m) * ringR}px)` +
    ` rotateX(${m * drumDeg}deg) translateZ(${m * drumR}px)` +
    ` rotateZ(${faceCounterRotate}deg)`
  );
}

type Stage = { w: number; h: number };

// ─── Component ───────────────────────────────────────────────────────────────

export function SpaceWheel({
  items,
  turnRef,
  label,
  ringLabel,
  onActiveChange,
  ringTilt = 1,
  indexLabel,
  ringOuterRatio,
  ringCardWidthRatio,
  navHeight = 64,
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

  // Separate point items (drum) from ring-only items
  const pointItems = items.filter((item) => item.point !== undefined).sort((a, b) => (a.point ?? 0) - (b.point ?? 0));
  const pointCount = pointItems.length;
  const hasPoints = pointCount > 0;

  // If no point items, behave exactly as before (all items in drum, drum range 0 to count)
  const drumEnd = hasPoints ? pointCount : count;
  const last = Math.max(drumEnd - 1, 0);

  // Map global index to ring-only index for proper angle calculation
  const ringOnlyIndex: number[] = [];
  let ringIdx = 0;
  for (let i = 0; i < count; i++) {
    if (items[i]?.point === undefined) {
      ringOnlyIndex[i] = ringIdx++;
    }
  }
  const ringOnlyCount = ringIdx;

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
    let { w, h } = stage;

    // If navHeight is provided (About page), subtract it from h to get true stage height
    // This accounts for the sticky nav that overlays the viewport
    if (navHeight && h > 0) {
      h = Math.max(h - navHeight, 0);
    }

    const isMobile = w <= MOBILE_BREAKPOINT;

    // Ring geometry: if props provided, override defaults
    let ringOuter: number;
    let cardW_ring: number;
    let cardH_ring: number;

    if (ringOuterRatio !== undefined && ringCardWidthRatio !== undefined && h > 0) {
      // About page: explicit ring outer diameter and card width ratio
      ringOuter = h * ringOuterRatio;
      cardW_ring = ringOuter * ringCardWidthRatio;
      cardH_ring = cardW_ring / CARD_RATIO;
    } else {
      // Default: use original formula
      const cardH_base = isMobile ? CARD_H_MOBILE : CARD_H_DESKTOP;
      const cardMaxW_base = isMobile ? CARD_MAX_W_MOBILE : CARD_MAX_W_DESKTOP;
      cardW_ring = Math.min(h * cardH_base * CARD_RATIO, w * cardMaxW_base);
      cardH_ring = cardW_ring / CARD_RATIO;
      const ringR_base = cardH_ring * RING_R;
      ringOuter = 2 * ringR_base;
    }

    // For drum (front card), use original formula
    const cardH_base = isMobile ? CARD_H_MOBILE : CARD_H_DESKTOP;
    const cardMaxW_base = isMobile ? CARD_MAX_W_MOBILE : CARD_MAX_W_DESKTOP;
    const cardW_drum = Math.min(h * cardH_base * CARD_RATIO, w * cardMaxW_base);
    const cardH_drum = cardW_drum / CARD_RATIO;

    const drumR = cardH_drum * DRUM;
    const ringR = ringOuter / 2;

    // For ring scaling: use total count (including ring-only items)
    const ringScale = count
      ? clamp((((2 * Math.PI * ringR) / count) * 0.82) / (cardW_ring || 1), 0.16, 1)
      : 1;
    return {
      cardW: cardW_ring,  // Ring card width
      cardW_drum,         // Drum front card width (separate)
      cardH: cardH_ring,  // Ring card height
      cardH_drum,
      ringR,
      ringOuter,
      ringScale,
      drumR,
      bow: cardH_drum * BOW,
      depth: cardH_drum * LENS,
      title: cardH_drum * TITLE,
      index: cardH_drum * INDEX,
      isMobile,
    };
  }, [stage, count, ringOuterRatio, ringCardWidthRatio, navHeight]);

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

      // Pull the drum back so its front face lands on the picture plane
      if (wheelRef.current) {
        wheelRef.current.style.transform = `translateZ(${-m * drumR}px)`;
      }

      for (let i = 0; i < count; i++) {
        const item = items[i];
        const card = cardRefs.current[i];
        if (!card) continue;

        const isPointItem = item.point !== undefined;

        if (isPointItem) {
          // Point item: place on drum
          const pointIdx = item.point!;
          const d = pointIdx - pos;
          const drumDeg = d * STEP;
          const ringDeg = 0; // Not used in drum mode, but kept for place() signature

          card.style.transform = place(
            ringDeg,
            drumDeg,
            ringR,
            drumR,
            bow,
            m,
            ringTilt,
          );

          const cardOpacity = m > 0.5 && Math.abs(d) > CULL ? 0 : 1;
          card.style.opacity = String(cardOpacity);
          card.style.zIndex = String(Math.round(100 - Math.abs(d) * 2));
          card.style.willChange = cardOpacity > 0.1 ? 'transform' : 'auto';
        } else {
          // Ring-only item: always visible on ring, no fade or shrinking
          const idx = ringOnlyIndex[i] ?? 0;
          const ringAngleDeg = ringOnlyCount > 0 ? idx * (360 / ringOnlyCount) : 0;

          card.style.transform = place(
            ringAngleDeg,
            0,
            ringR,
            drumR,
            bow,
            0, // m=0 for ring state (no transition to drum)
            ringTilt,
          );
          card.style.opacity = String(1); // Always fully visible
          card.style.visibility = "visible";
          card.style.zIndex = String(50); // Behind drum cards
          card.style.willChange = 'auto';
        }

        const face = card.firstElementChild as HTMLElement | null;
        if (face) {
          if (isPointItem) {
            // Drum: card at full scale
            face.style.transform = `scale(1)`;
          } else {
            // Ring: always use ring scale, no animation
            face.style.transform = `scale(${ringScale})`;
          }
          if (item.focalPoint) {
            face.style.objectPosition = item.focalPoint;
          }
        }
      }

      if (labelRef.current) labelRef.current.style.opacity = String(1 - m);
      if (titleRef.current) titleRef.current.style.opacity = String(m);
      if (descRef.current) descRef.current.style.opacity = String(m);

      // Active: only point items
      if (hasPoints) {
        const near = clamp(Math.round(pos), 0, last);
        setActive((prev) => {
          if (prev !== near) onActiveChange?.(near);
          return prev === near ? prev : near;
        });
      }
    };

    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [metrics, stage.h, count, last, reduced, turnRef, onActiveChange, isVisible, hasPoints, items, ringTilt]);

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
        style={{ perspective: `${metrics.depth}px`, overflowX: "clip", overflowY: "clip" }}
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
        {label ?? ringLabel}
      </div>

      {/* ── Mobile text block (bottom-aligned description only, no flex layout) ── */}
      {metrics.isMobile && hasPoints && (
        <div
          ref={titleRef}
          className="pointer-events-none absolute left-0 right-0 bottom-0 opacity-0"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            paddingLeft: "1.5rem",
            paddingRight: "1.5rem",
            paddingTop: "1rem",
            paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))",
          }}
        >
          <p
            className="font-semibold leading-snug text-xs"
            style={{
              fontFamily: "'Good Times', monospace",
              fontSize: "clamp(12px, 3vw, 13px)",
              color: "rgba(0,0,0,0.45)",
              marginBottom: "0.5rem",
            }}
          >
            {indexLabel ? indexLabel(active) : `${String(active + 1).padStart(2, "0")} / ${String(pointCount).padStart(2, "0")}`}
          </p>
          <p
            className="font-semibold leading-snug"
            style={{ fontFamily: "'Noto Sans TC', sans-serif", fontSize: "clamp(1.5rem, 6.5vw, 2rem)", color: "#000000", marginBottom: "0.5rem" }}
          >
            {activeItem?.title}
          </p>
          <p
            className="leading-relaxed max-w-[90%]"
            style={{
              fontFamily: "'Noto Sans TC', sans-serif",
              fontSize: "16px",
              color: "#000000",
            }}
          >
            <span className="font-semibold">{activeItem?.description.split("。")[0]}。</span>
            <span style={{ color: "rgba(0,0,0,0.6)" }}>
              {activeItem?.description.split("。").slice(1).join("。")}
            </span>
          </p>
        </div>
      )}

      {/* ── Desktop text (left of card) ── */}
      {!metrics.isMobile && hasPoints && (
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
      {hasPoints && (
        metrics.isMobile ? (
          <div
            ref={descRef}
            className="pointer-events-none absolute top-[6%] left-1/2 -translate-x-1/2 opacity-0 flex flex-col items-center gap-2"
            style={{ visibility: "hidden" }}
          >
            <div className="flex items-center gap-1">
              {pointItems.map((_, i) => (
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
              {indexLabel ? indexLabel(active) : `${String(active + 1).padStart(2, "0")} / ${String(pointCount).padStart(2, "0")}`}
            </p>
          </div>
        ) : (
          <ol
            className="absolute top-[7.5%] right-[2.5%] text-right leading-[1.75]"
            style={{ fontSize: metrics.index }}
            aria-hidden="true"
          >
            {pointItems.map((_, i) => (
              <li key={i}>
                <span
                  className="block transition-colors duration-300"
                  style={{
                    fontFamily: "'Good Times', monospace",
                    color: i === active ? "#000000" : "rgba(0,0,0,0.45)",
                    fontWeight: i === active ? 600 : 400,
                  }}
                >
                  {indexLabel ? indexLabel(i) : String(i + 1).padStart(2, "0")}
                </span>
              </li>
            ))}
          </ol>
        )
      )}
    </section>
  );
}

export default SpaceWheel;
