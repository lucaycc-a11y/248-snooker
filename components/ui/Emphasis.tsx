"use client";

// Inline emphasis: bold + full contrast for the marked span, the rest
// at a lighter weight/colour.  Accepts a string that uses «…» guillemet
// markers to delimit the emphasised run(s).  Everything outside the
// markers renders at the `dim` style; everything inside at `strong`.
//
// Usage:
//   <Emphasis text="打造屬於你的《純粹玩樂》時光" />
//
// i18n strings store the markers directly, e.g.:
//   "hero_emphasis": "打造屬於你的《純粹玩樂》時光"
//
// We chose guillemets (《》) over backticks or asterisks because they
// are semantically neutral in CJK text, visually unambiguous, and
// survive JSON serialisation without escaping.

import * as React from "react";
import { cn } from "@/lib/utils";

export interface EmphasisProps {
  /** Raw string with 《…》 markers around the emphasised spans. */
  text: string;
  className?: string;
  /** Tailwind classes applied to the dim (non-emphasised) runs. */
  dimClassName?: string;
  /** Tailwind classes applied to the strong (emphasised) runs. */
  strongClassName?: string;
}

// Normalise **…** Markdown-style bold markers to 《》 so a single parser
// handles both formats.  Translators may use either convention.
function normaliseMarkers(raw: string): string {
  return raw.replace(/\*\*([^*]+)\*\*/g, "《$1》");
}

// Split on 《 and 》 alternately.  Odd-indexed segments are emphasised.
function parseEmphasis(raw: string): Array<{ text: string; strong: boolean }> {
  const normalised = normaliseMarkers(raw);
  const parts = normalised.split(/[《》]/);
  return parts
    .filter((p) => p.length > 0)
    .map((text, i) => ({ text, strong: i % 2 === 1 }));
}

export function Emphasis({
  text,
  className,
  dimClassName,
  strongClassName,
}: EmphasisProps) {
  const segments = parseEmphasis(text);

  return (
    <span className={cn("inline", className)}>
      {segments.map((seg, i) =>
        seg.strong ? (
          <strong
            key={i}
            className={cn(
              "font-semibold text-[inherit] brightness-150",
              strongClassName,
            )}
            style={{ color: "currentColor", filter: "none" }}
          >
            {seg.text}
          </strong>
        ) : (
          <span
            key={i}
            className={cn("font-normal opacity-60", dimClassName)}
          >
            {seg.text}
          </span>
        ),
      )}
    </span>
  );
}

export default Emphasis;
