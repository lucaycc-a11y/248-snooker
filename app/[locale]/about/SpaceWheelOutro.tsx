"use client";

// Closing section — appears after SpaceWheel, before Contact Us.
//
// Design: white-to-green gradient band, headline with static echo ghosts,
// 8-ball straddling the band's bottom edge, description, steps, CTA buttons.
// Animation handled by useSpaceWheelOutroAnim (sibling file).
//
// Section-scoped CSS tokens (never touch global tokens):
//   --closing-green: #199f02
//   --closing-mint:  #93ff80
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useSpaceWheelOutroAnim } from "./useSpaceWheelOutroAnim";

// Ball image is 2000×2000px; visible ball fills ~83% of each dimension.
// BALL_FILL = 0.83 → <img> is sized at 100%/BALL_FILL so the wrapper box
// equals the visible ball diameter.
const BALL_FILL = 0.831;

type StepItem = { title: string; body: string };

export function SpaceWheelOutro() {
  const t = useTranslations("aboutPage");
  useSpaceWheelOutroAnim();

  // Steps: use array index for numeral (01/02/03), title from i18n.
  const steps = t.raw("cta_steps") as StepItem[];

  return (
    <section
      className="relative w-full overflow-visible"
      aria-labelledby="closing-heading"
      data-nav-theme="light"
      data-outro-section
      style={
        {
          "--closing-green": "#199f02",
          "--closing-mint": "#93ff80",
        } as React.CSSProperties
      }
    >
      {/* ── Gradient band ─────────────────────────────────────────────────────
          Full-bleed. Height ~35vw, clamped to [520px, 640px].
          Top edge is #ffffff so it joins the white SpaceWheel section above
          with zero seam.
      */}
      <div
        data-outro-band
        style={{
          width: "100%",
          height: "clamp(520px, 34.96vw, 640px)",
          background:
            "linear-gradient(180deg, #ffffff 1.4%, #93ff80 42.8%, #199f02 100%)",
          position: "relative",
          overflow: "visible",
        }}
      >
        {/* ── Content column: max 1728px, centred ─────────────────────────── */}
        <div
          style={{
            maxWidth: 1728,
            margin: "0 auto",
            height: "100%",
            position: "relative",
          }}
        >
          {/* ── Headline group (wrapper carries parallax scroll) ─────────── */}
          <div
            data-outro-headline-group
            style={{
              position: "absolute",
              top: "43%", // ~262px / 604px ≈ 43.4%
              left: 0,
              right: 0,
              textAlign: "center",
              pointerEvents: "none",
            }}
          >
            {/* Main headline — screen-reader label on the heading */}
            <h2
              id="closing-heading"
              aria-label={t("closing_headline")}
              data-outro-headline-chars
              style={{
                fontFamily: "'Noto Sans TC', sans-serif",
                fontWeight: 800,
                fontSize: "clamp(2.25rem, 3.703vw, 4rem)",
                lineHeight: 1.2,
                color: "#ffffff",
                margin: 0,
                position: "relative",
                zIndex: 2,
                letterSpacing: "-0.01em",
              }}
            >
              {/* Per-character spans for staggered entrance; aria-hidden */}
              {t("closing_headline")
                .split("")
                .map((ch, i) => (
                  <span
                    key={i}
                    aria-hidden="true"
                    data-outro-char={i}
                    style={{ display: "inline-block" }}
                  >
                    {ch}
                  </span>
                ))}
            </h2>

            {/* Ghost 1 — 0.906× size, +0.75em below, opacity 0.9 at rest */}
            <p
              aria-hidden="true"
              data-outro-echo="1"
              style={{
                fontFamily: "'Noto Sans TC', sans-serif",
                fontWeight: 800,
                fontSize: "clamp(2.04rem, 3.355vw, 3.625rem)", // 0.906×
                lineHeight: 1.2,
                margin: 0,
                position: "absolute",
                top: "calc(100% + 0.75em - 1.2em * 0.906)", // offset from heading baseline
                left: 0,
                right: 0,
                textAlign: "center",
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0) 8%, rgba(235,235,235,0.9) 92%)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                WebkitTextFillColor: "transparent",
                color: "transparent",
                opacity: 0.9,
                userSelect: "none",
                pointerEvents: "none",
                zIndex: 1,
              }}
            >
              {t("closing_headline")}
            </p>

            {/* Ghost 2 — 0.8125× size, +1.41em below, opacity 0.7 at rest */}
            <p
              aria-hidden="true"
              data-outro-echo="2"
              style={{
                fontFamily: "'Noto Sans TC', sans-serif",
                fontWeight: 800,
                fontSize: "clamp(1.83rem, 3.009vw, 3.25rem)", // 0.8125×
                lineHeight: 1.2,
                margin: 0,
                position: "absolute",
                top: "calc(100% + 1.41em - 1.2em * 0.8125)",
                left: 0,
                right: 0,
                textAlign: "center",
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0) 8%, rgba(235,235,235,0.7) 92%)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                WebkitTextFillColor: "transparent",
                color: "transparent",
                opacity: 0.7,
                userSelect: "none",
                pointerEvents: "none",
                zIndex: 1,
              }}
            >
              {t("closing_headline")}
            </p>
          </div>
        </div>
      </div>

      {/* ── White section below the band ────────────────────────────────────── */}
      <div
        style={{
          background: "#ffffff",
          position: "relative",
          width: "100%",
          paddingBottom: "clamp(96px, 12.9vw, 223px)",
        }}
      >
        {/* ── 8-ball — centre on band bottom edge ───────────────────────────
            Outer wrapper carries scroll-parallax Y.
            Inner wrapper carries entrance Y + scale + opacity.
            Ball visible diameter: clamp(170px, 19.33vw, 334px).
            Image is 120.4% to compensate for the 83.1% fill ratio.
        */}
        <div
          data-outro-ball-scroll
          style={{
            position: "absolute",
            top: 0,
            left: "50%",
            transform: "translateX(-50%) translateY(-50%)",
            width: "clamp(170px, 19.33vw, 334px)",
            height: "clamp(170px, 19.33vw, 334px)",
            zIndex: 10,
          }}
        >
          <div
            data-outro-ball-enter
            style={{ width: "100%", height: "100%", position: "relative" }}
          >
            {/* Image is sized at 100%/BALL_FILL to crop the transparent padding */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                overflow: "visible",
              }}
            >
              <Image
                src="/images/space8-about-photos/images/about-8ball.webp"
                alt=""
                aria-hidden="true"
                width={2000}
                height={2000}
                style={{
                  position: "absolute",
                  width: `${(1 / BALL_FILL) * 100}%`,
                  height: `${(1 / BALL_FILL) * 100}%`,
                  left: `${((1 - 1 / BALL_FILL) / 2) * 100}%`,
                  top: `${((1 - 1 / BALL_FILL) / 2) * 100}%`,
                  objectFit: "contain",
                  userSelect: "none",
                  pointerEvents: "none",
                }}
                priority={false}
                sizes="(max-width: 767px) 170px, (max-width: 1728px) 19.33vw, 334px"
              />
            </div>
          </div>
        </div>

        {/* ── Content column ──────────────────────────────────────────────── */}
        <div
          style={{
            maxWidth: 1728,
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            paddingTop: "clamp(170px, 19.33vw, 334px)", // ball height + 24px
          }}
        >
          {/* ── Description ──────────────────────────────────────────────── */}
          <p
            data-outro-desc
            style={{
              fontFamily: "'Noto Sans TC', sans-serif",
              fontSize: "clamp(1rem, 1.389vw, 1.5rem)",
              lineHeight: 1.6,
              color: "#000000",
              margin: 0,
              marginTop: "clamp(12px, 1.389vw, 24px)",
              padding: "0 24px",
            }}
          >
            {/* Line 1: first clause normal weight, 隨時隨地開局。bold */}
            <span style={{ color: "#2f2f2f", fontWeight: 500 }}>
              一鍵預訂專屬球臺，
            </span>
            <strong style={{ fontWeight: 800, color: "#000000" }}>
              隨時隨地開局。
            </strong>
            <br />
            {/* Line 2: entirely bold */}
            <strong style={{ fontWeight: 800, color: "#000000" }}>
              由預訂、付款到入場，全程自助，無需等候。
            </strong>
          </p>

          {/* ── Steps ────────────────────────────────────────────────────── */}
          <div
            data-outro-steps
            style={{
              display: "flex",
              justifyContent: "center",
              gap: "clamp(24px, 5.556vw, 96px)",
              marginTop: "clamp(32px, 3.472vw, 60px)",
              padding: "0 24px",
              width: "100%",
            }}
          >
            {steps.map((step, i) => (
              <div
                key={step.title}
                data-outro-step={i}
                style={{ textAlign: "center" }}
              >
                <p
                  style={{
                    fontFamily: "'Good Times', monospace",
                    fontWeight: 400,
                    fontSize: "clamp(1.75rem, 2.315vw, 2.5rem)",
                    color: "var(--closing-green, #199f02)",
                    margin: 0,
                    lineHeight: 1,
                  }}
                >
                  {String(i + 1).padStart(2, "0")}
                </p>
                <p
                  style={{
                    fontFamily: "'Noto Sans TC', sans-serif",
                    fontWeight: 500,
                    fontSize: "clamp(0.9375rem, 1.389vw, 1.5rem)",
                    color: "#000000",
                    margin: "8px 0 0",
                    lineHeight: 1.3,
                  }}
                >
                  {step.title}
                </p>
              </div>
            ))}
          </div>

          {/* ── CTA Buttons ──────────────────────────────────────────────── */}
          <div
            data-outro-buttons
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: "clamp(12px, 6.424vw, 111px)",
              marginTop: "clamp(40px, 4.63vw, 80px)",
              padding: "0 24px",
              flexWrap: "wrap",
            }}
          >
            <Link
              href="/book"
              className="closing-btn-primary"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "'Noto Sans TC', sans-serif",
                fontWeight: 500,
                fontSize: "clamp(1rem, 1.389vw, 1.5rem)",
                color: "#000000",
                background: "var(--closing-green, #199f02)",
                borderRadius: 9999,
                border: "none",
                cursor: "pointer",
                textDecoration: "none",
                minWidth: 150,
                padding: "0 clamp(20px, 2.778vw, 48px)",
                height: "clamp(52px, 3.993vw, 69px)",
                transition:
                  "background-color 200ms ease, transform 200ms ease, opacity 200ms ease",
              }}
            >
              {t("cta_primary")}
            </Link>

            <Link
              href="/pricing"
              className="closing-btn-secondary"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "'Noto Sans TC', sans-serif",
                fontWeight: 500,
                fontSize: "clamp(1rem, 1.389vw, 1.5rem)",
                color: "rgba(0,0,0,0.71)",
                background: "transparent",
                borderRadius: 9999,
                border: "1px solid rgba(0,0,0,0.43)",
                cursor: "pointer",
                textDecoration: "none",
                minWidth: 150,
                padding: "0 clamp(20px, 2.778vw, 48px)",
                height: "clamp(52px, 3.993vw, 69px)",
                transition:
                  "border-color 200ms ease, transform 200ms ease, opacity 200ms ease",
              }}
            >
              {t("cta_secondary")}
            </Link>
          </div>
        </div>
      </div>

      {/* ── Button hover / focus styles injected once ─────────────────────── */}
      <style>{`
        .closing-btn-primary:hover {
          background-color: #157a01 !important;
          transform: translateY(-2px);
        }
        .closing-btn-primary:active {
          transform: translateY(0);
        }
        .closing-btn-primary:focus-visible {
          outline: 2px solid #199f02;
          outline-offset: 3px;
        }
        .closing-btn-secondary:hover {
          border-color: rgba(0,0,0,0.8) !important;
          transform: translateY(-2px);
        }
        .closing-btn-secondary:active {
          transform: translateY(0);
        }
        .closing-btn-secondary:focus-visible {
          outline: 2px solid #199f02;
          outline-offset: 3px;
        }
        @media (max-width: 479px) {
          .closing-btn-primary,
          .closing-btn-secondary {
            min-width: 0;
            width: min(100%, 320px);
          }
        }
      `}</style>
    </section>
  );
}

export default SpaceWheelOutro;
