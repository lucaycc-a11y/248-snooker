"use client";

// Closing section — appears after the last SpaceWheel photo, before Contact Us.
//
// Layout:
//   Dark gradient band (charcoal → near-black) with a soft green radial glow
//   8-ball straddling the band's bottom edge (positioned absolutely)
//   Eyebrow · Headline line 1 · Headline line 2 (echo target)
//   Description (bold lead + grey remainder)
//   Stats row (4 items, count-up on animation pass)
//   Steps row
//   Two CTA buttons
//
// All copy from existing i18n keys — no hardcoded strings.
// Animation hooks: data-outro-* attributes; elements are visible by default.
// Animation is handled by SpaceWheelOutroAnim (sibling, not yet applied).
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useSpaceWheelOutroAnim } from "./useSpaceWheelOutroAnim-deprecated";

// ── Types matching the i18n shape ───────────────────────────────────────────
type StepItem = { title: string; body: string };
type StatItem = { value: string; unit: string; suffix: string; label: string };

export function SpaceWheelOutro() {
  const t = useTranslations("aboutPage");
  useSpaceWheelOutroAnim();

  const steps = t.raw("cta_steps") as StepItem[];
  const stats = t.raw("stats_items") as StatItem[];

  // Split "零打擾，全專註。打造專屬中八空間。" → two lines on the full-stop.
  // Works for all four locales: the sentence boundary is always a full-stop
  // (。 or . followed by a space or end of string).
  const fullStatement: string = t("mission_statement");
  const sentenceSplit = fullStatement.match(/^(.+?[。.])(.+)$/);
  const headlineL1 = sentenceSplit ? sentenceSplit[1].trim() : fullStatement;
  const headlineL2 = sentenceSplit ? sentenceSplit[2].trim() : "";

  // Description: use cta_subtitle; split bold lead (first sentence) from remainder.
  const ctaSubtitle: string = t("cta_subtitle");
  const descSplit = ctaSubtitle.match(/^(.+?[。.][）)，,]?)(.+)?$/s);
  const descBold = descSplit ? descSplit[1].trim() : ctaSubtitle;
  const descGrey = descSplit?.[2]?.trim() ?? "";

  return (
    <section
      className="relative w-full overflow-hidden"
      aria-labelledby="outro-heading"
      data-nav-theme="dark"
      data-outro-section
    >
      {/* ── Gradient band ─────────────────────────────────────────────────── */}
      <div
        className="relative w-full"
        style={{
          background:
            "linear-gradient(180deg, #1a1a1c 0%, #111113 60%, #0a0a0b 100%)",
          // Reserve space below for the ball overhang
          paddingBottom: "clamp(80px, 14vw, 140px)",
        }}
        data-outro-band
      >
        {/* Soft green radial glow behind the ball */}
        <div
          aria-hidden="true"
          data-outro-glow
          style={{
            position: "absolute",
            bottom: 0,
            left: "50%",
            transform: "translateX(-50%)",
            width: "min(560px, 90vw)",
            height: "min(420px, 70vw)",
            borderRadius: "50%",
            background:
              "radial-gradient(ellipse at center bottom, rgba(34,197,94,0.18) 0%, rgba(34,197,94,0.06) 45%, transparent 70%)",
            pointerEvents: "none",
          }}
        />

        {/* ── Text content ──────────────────────────────────────────────── */}
        <div
          className="relative z-10 mx-auto flex flex-col items-center gap-10 px-6 pt-20 text-center md:pt-28"
          style={{ maxWidth: 720 }}
        >
          {/* Eyebrow */}
          <p
            className="text-xs tracking-[0.28em] uppercase text-white/40"
            style={{ fontFamily: "'Good Times', monospace" }}
            data-outro-eyebrow
          >
            {t("mission_eyebrow")}
          </p>

          {/* Headline */}
          <div className="flex flex-col gap-1" data-outro-headline-group>
            <h2
              id="outro-heading"
              className="text-[clamp(1.75rem,6vw,3.25rem)] font-semibold leading-tight text-white"
              style={{ fontFamily: "'Noto Sans TC', sans-serif" }}
              data-outro-headline-1
            >
              {headlineL1}
            </h2>

            {/* Line 2 — echo ghost target for animation pass */}
            {headlineL2 && (
              <div className="relative" data-outro-headline-2-wrap>
                {/* Ghost copies (hidden; animation pass will show/fade them) */}
                {[1, 2, 3, 4].map((i) => (
                  <span
                    key={i}
                    aria-hidden="true"
                    data-outro-echo={i}
                    style={{
                      position: "absolute",
                      inset: 0,
                      fontFamily: "'Noto Sans TC', sans-serif",
                      fontSize: "clamp(1.75rem,6vw,3.25rem)",
                      fontWeight: 600,
                      lineHeight: "1.2",
                      color: "white",
                      opacity: 0,
                      userSelect: "none",
                      pointerEvents: "none",
                      whiteSpace: "nowrap",
                      display: "flex",
                      justifyContent: "center",
                    }}
                  >
                    {headlineL2}
                  </span>
                ))}
                <h2
                  className="text-[clamp(1.75rem,6vw,3.25rem)] font-semibold leading-tight text-white"
                  style={{ fontFamily: "'Noto Sans TC', sans-serif" }}
                  data-outro-headline-2
                >
                  {headlineL2}
                </h2>
              </div>
            )}
          </div>

          {/* Description */}
          <p
            className="max-w-lg text-base leading-relaxed"
            style={{ fontFamily: "'Noto Sans TC', sans-serif" }}
          >
            <strong
              className="font-semibold text-white"
              data-outro-desc-bold
            >
              {descBold}
            </strong>
            {descGrey && (
              <span
                className="text-white/55"
                data-outro-desc-grey
              >
                {" "}
                {descGrey}
              </span>
            )}
          </p>

          {/* Stats row */}
          <ul
            className="flex w-full flex-wrap justify-center gap-x-10 gap-y-6 border-t border-white/10 pt-8 list-none"
            aria-label={t("mission_eyebrow")}
            data-outro-stats
          >
            {stats.map((stat) => (
              <li
                key={stat.label}
                className="flex flex-col items-center gap-0.5"
                data-outro-stat
              >
                <span
                  className="text-3xl font-bold tabular-nums text-white"
                  style={{ fontFamily: "'Good Times', monospace" }}
                >
                  <span data-outro-stat-value={stat.value}>
                    {stat.value}
                  </span>
                  {stat.unit && (
                    <span className="ml-0.5 text-base font-normal text-white/50">
                      {stat.unit}
                    </span>
                  )}
                  {stat.suffix && (
                    <span className="text-base font-normal text-white/50">
                      {stat.suffix}
                    </span>
                  )}
                </span>
                <span
                  className="text-xs text-white/50"
                  style={{ fontFamily: "'Noto Sans TC', sans-serif" }}
                >
                  {stat.label}
                </span>
              </li>
            ))}
          </ul>

          {/* Steps row */}
          <ol
            className="flex flex-wrap justify-center gap-x-8 gap-y-3 list-none"
            aria-label="預訂步驟"
            data-outro-steps
          >
            {steps.map((step, i) => (
              <li
                key={step.title}
                className="flex items-center gap-2.5"
                data-outro-step
              >
                <span
                  className="tabular-nums text-xs"
                  style={{
                    fontFamily: "'Good Times', monospace",
                    color: "#22c55e",
                  }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span
                  className="text-sm font-semibold text-white/80"
                  style={{ fontFamily: "'Noto Sans TC', sans-serif" }}
                >
                  {step.title}
                </span>
              </li>
            ))}
          </ol>

          {/* CTA buttons */}
          <div
            className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:justify-center"
            data-outro-buttons
          >
            <Link
              href="/book"
              className="inline-flex items-center justify-center rounded-full bg-[#22c55e] px-7 text-base font-semibold text-black transition hover:bg-[#16a34a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#22c55e]"
              style={{
                fontFamily: "'Noto Sans TC', sans-serif",
                height: 48,
                maxWidth: "min(100%, 320px)",
              }}
              data-outro-btn-primary
            >
              {t("cta_primary")}
            </Link>
          </div>
        </div>
      </div>

      {/* ── 8-ball — straddles the band's bottom edge ──────────────────────── */}
      {/*
        Outer wrapper: scroll-linked translateY (animation pass).
        Inner wrapper: float-up entrance translateY (animation pass).
        This keeps the two transforms on separate elements so they never fight.
      */}
      <div
        aria-hidden="true"
        data-outro-ball-scroll
        style={{
          position: "absolute",
          bottom: 0,
          left: "50%",
          transform: "translateX(-50%)",
          // Ball is 180px tall; sits so 50% is below the band edge.
          width: "clamp(140px, 22vw, 200px)",
          height: "clamp(140px, 22vw, 200px)",
          zIndex: 20,
          // translateY on this wrapper is driven by scroll (animation pass).
        }}
      >
        <div
          data-outro-ball-enter
          style={{ width: "100%", height: "100%" }}
        >
          <Image
            src="/images/space8-about-photos/images/about-8ball.webp"
            alt=""
            fill
            sizes="(max-width: 767px) 140px, (max-width: 1199px) 22vw, 200px"
            style={{ objectFit: "contain" }}
            priority={false}
          />
        </div>
      </div>
    </section>
  );
}

export default SpaceWheelOutro;
