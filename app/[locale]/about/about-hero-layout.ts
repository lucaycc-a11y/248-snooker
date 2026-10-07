// Fit procedure for the About hero: a ring of 8 photos with the heading
// inside it and the description + buttons below it. Pure, so it can be
// reasoned about (and tested) without a DOM.

// Reference ring (fb4fee0), measured at 1194×834, 1440×900 and 390×844:
// card-centre diameter = 0.618 × viewport height, card width = 0.24 × that.
const RING_DIAMETER = 0.618;
const RING_CARD_W = 0.24;
const CARD_RATIO = 1.5;
const MOBILE_BREAKPOINT = 768;
const MOBILE_WIDTH = 0.88;      // phone: ring outer extent ≤ 88vw…
const MOBILE_HEIGHT = 0.5;      // …and ≤ 0.5 × stage height
const MIN_RING = 0.62;          // never scale the ring's outer extent below this × stage
const GAP = 24;                 // ring ↔ text, and inner padding of the free circle
const MARGIN = 32;              // clear of the stage's 28px edge fades, top and bottom
const HEADING_MAX = 32;
const HEADING_MIN = 18;
const HEADING_CHARS = 9;        // 一個 + 4-char word + 的空間, in em
const LOGO_H = 28;
const LOGO_GAP = 12;
export const DESC_LARGE = 16;
export const DESC_SMALL = 13;

export interface HeroMeasure {
  stageW: number;
  stageH: number;
  /** Bottom edge of the navbar, in stage coordinates. */
  navBottom: number;
  /** Height of the description + buttons block as rendered right now. */
  textH: number;
  /** Height of the description paragraph alone, and the size it was set at. */
  descH: number;
  descSize: number;
}

export interface HeroLayout {
  /** Card-centre radius and ring card size, px. */
  r: number;
  cardW: number;
  cardH: number;
  /** Ring centre offset from the stage centre, px. */
  offsetY: number;
  /** Top of the text block, px from the stage top. */
  textTop: number;
  headingSize: number;
  descSize: number;
  showLogo: boolean;
  isMobile: boolean;
  /** Fit fallbacks that fired, in order, for the report. */
  fallbacks: string[];
  /** True when even every fallback could not make it fit (never overlaps). */
  overflow: boolean;
}

export function fitHero(m: HeroMeasure): HeroLayout {
  const isMobile = m.stageW < MOBILE_BREAKPOINT;
  const avail = m.stageH - m.navBottom;
  const fallbacks: string[] = [];

  // Base ring: the reference on desktop; on phones the whole ring
  // (card-centre diameter + one card height) must fit the width cap.
  let r: number;
  let cardW: number;
  if (isMobile) {
    const outer = Math.min(MOBILE_WIDTH * m.stageW, MOBILE_HEIGHT * avail);
    // outer = 2r + cardH, cardW = 0.24 × 2r, cardH = cardW / 1.5
    r = outer / (2 + (2 * RING_CARD_W) / CARD_RATIO);
    cardW = 2 * r * RING_CARD_W;
  } else {
    r = (RING_DIAMETER * m.stageH) / 2;
    // Portrait tablets: the side cards (rotated 90°) span 2r + cardH across;
    // keep that inside the stage width with a 24px margin.
    const maxR = (m.stageW - 2 * GAP) / (2 + (2 * RING_CARD_W) / CARD_RATIO);
    if (r > maxR) {
      r = maxR;
      fallbacks.push("ring width-capped");
    }
    cardW = 2 * r * RING_CARD_W;
  }
  let cardH = cardW / CARD_RATIO;

  // Vertical fit: ring outer extent + gap + text block within the stage.
  const fits = (outer: number, textH: number) =>
    outer + GAP + textH <= avail - 2 * MARGIN;
  // Always start from 16px; the measured block (at whatever size it is set
  // now) is rescaled to estimate the other size.
  let descSize = DESC_LARGE;
  const textAt = (size: number) =>
    m.textH - m.descH + m.descH * (size / m.descSize);
  let textH = textAt(descSize);
  let outer = 2 * r + cardH;

  if (!fits(outer, textH) && descSize > DESC_SMALL && !isMobile) {
    descSize = DESC_SMALL;
    textH = textAt(descSize);
    fallbacks.push("description 13px");
  }
  let overflow = false;
  if (!fits(outer, textH)) {
    const target = avail - 2 * MARGIN - GAP - textH;
    const floor = MIN_RING * m.stageH;
    const next = Math.max(target, Math.min(floor, outer));
    const k = next / outer;
    r *= k;
    cardW *= k;
    cardH *= k;
    outer = next;
    fallbacks.push(`ring ×${k.toFixed(2)}`);
    overflow = !fits(outer, textH);
  }

  // Inside the ring: the free circle is bounded by the inner corners of the
  // side cards (rotated 90°), so subtract the card width there.
  const free = 2 * r - cardW - GAP;
  let headingSize = Math.min(HEADING_MAX, (0.9 * free) / HEADING_CHARS);
  let showLogo = true;
  if (LOGO_H + LOGO_GAP + headingSize * 1.3 > 0.6 * free) {
    showLogo = false;
    fallbacks.unshift("logo hidden");
  }
  if (headingSize < HEADING_MIN) {
    headingSize = HEADING_MIN;
    fallbacks.unshift("heading at minimum");
  }

  // Centre ring + text in the band below the navbar.
  const total = outer + GAP + textH;
  const top = m.navBottom + Math.max(MARGIN, (avail - total) / 2);
  const ringCentre = top + outer / 2;
  return {
    r,
    cardW,
    cardH,
    offsetY: ringCentre - m.stageH / 2,
    textTop: top + outer + GAP,
    headingSize,
    descSize,
    showLogo,
    isMobile,
    fallbacks,
    overflow,
  };
}
