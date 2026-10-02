"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { QRCodeSVG } from "qrcode.react";
import { cn } from "@/lib/utils";
import Velaris from "@/components/ui/velaris";

// ─── Design tokens ───────────────────────────────────────────────────────────
const COLORS = {
  // Green palette (from #86efac → #22c55e → #059669 range)
  green50: "#86efac",
  green400: "#4ade80",
  green500: "#22c55e",
  green600: "#059669",

  // Dark theme tokens
  dark: {
    bg: "#000000",
    text: "#ffffff",
    textMuted: "rgba(255,255,255,0.6)",
    cardBg: "linear-gradient(150deg,#2B3039 0%,#1B1E24 55%,#23272F 100%)",
    cardBorder: "rgba(255,255,255,0.12)",
    accent: "#22c55e", // Solid green for pills/accents
  },

  // Light theme tokens
  light: {
    bg: "#F9FAFB",
    text: "#111827",
    textMuted: "#6B7280",
    accent: "#059669", // Darker green for light backgrounds
  },
} as const;

const EASING = {
  reveal: "cubic-bezier(.2,.7,.3,1)" as const,
  pop: "cubic-bezier(.34,1.56,.64,1)" as const,
};

// Demo member code for the card (not real user data)
const DEMO_CODE = "SPACE8-••••-••••";

// ─── Reveal animation wrapper ─────────────────────────────────────────────────
function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.15 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn(
        "transition-all duration-700",
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6",
        className
      )}
      style={{
        transitionDelay: `${delay}ms`,
        transitionTimingFunction: EASING.reveal,
      }}
    >
      {children}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// § 1 — HERO (Apple Music style, Velaris background)
// ═══════════════════════════════════════════════════════════════════════════

function HeroSection({ t }: { t: ReturnType<typeof useTranslations> }) {
  return (
    <Velaris
      height="min(100svh, 820px)"
      speed={1.0}
      colors={[COLORS.green50, COLORS.green400, COLORS.green600, COLORS.dark.bg]}
      className="flex items-center justify-center px-6"
    >
      <div className="flex min-h-full flex-col items-center justify-center text-center w-full">
        {/* Eyebrow */}
        <Reveal>
          <p
            data-cms-key="memberIntro.hero.eyebrow"
            className="mb-4 text-xs font-semibold uppercase tracking-widest"
            style={{ color: "rgba(255,255,255,0.7)", fontFamily: "'Good Times', sans-serif" }}
          >
            {t("hero.eyebrow")}
          </p>
        </Reveal>

        {/* Title */}
        <Reveal delay={100}>
          <h1
            data-cms-key="memberIntro.hero.title"
            className="mb-6 font-bold leading-tight tracking-tight text-white"
            style={{ fontSize: "clamp(2.5rem, 7vw, 5.5rem)" }}
          >
            {t("hero.title")}
          </h1>
        </Reveal>

        {/* Subtitle */}
        <Reveal delay={200}>
          <p
            data-cms-key="memberIntro.hero.subtitle"
            className="mb-10 text-base leading-relaxed md:text-lg"
            style={{ color: "rgba(255,255,255,0.75)", maxWidth: "36rem" }}
          >
            {t("hero.subtitle")}
          </p>
        </Reveal>

        {/* CTAs */}
        <Reveal delay={300}>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/join"
              data-cms-key="memberIntro.hero.ctaPrimary"
              className="rounded-full bg-white px-8 py-3.5 text-base font-semibold text-black transition hover:bg-white/90"
            >
              {t("hero.ctaPrimary")}
            </Link>
            <Link
              href="/auth"
              data-cms-key="memberIntro.hero.ctaSecondary"
              className="group flex items-center gap-1 text-base font-medium text-white transition hover:text-white/80"
            >
              <span>{t("hero.ctaSecondary")}</span>
              <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">›</span>
            </Link>
          </div>
        </Reveal>

        {/* Note */}
        <Reveal delay={400}>
          <p
            data-cms-key="memberIntro.hero.note"
            className="mt-6 text-xs"
            style={{ color: "rgba(255,255,255,0.5)" }}
          >
            {t("hero.note")}
          </p>
        </Reveal>
      </div>
    </Velaris>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// § 2 — STATEMENTS (Apple One style, light background)
// ═══════════════════════════════════════════════════════════════════════════

function StatementsSection({ t }: { t: ReturnType<typeof useTranslations> }) {
  return (
    <section style={{ background: COLORS.light.bg, padding: "clamp(88px, 12vw, 140px) 24px" }}>
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-12">
        {[1, 2, 3, 4].map((n, i) => (
          <Reveal key={n} delay={i * 100} className="text-center">
            <div className="space-y-2">
              <p
                data-cms-key={`memberIntro.pillar${n}.lead`}
                className="text-3xl font-semibold leading-tight md:text-5xl"
                style={{ color: COLORS.light.accent }}
              >
                {t(`pillar${n}.lead`)}
              </p>
              <p
                data-cms-key={`memberIntro.pillar${n}.body`}
                className="text-3xl font-semibold leading-tight md:text-5xl"
                style={{ color: COLORS.light.text }}
              >
                {t(`pillar${n}.body`)}
              </p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// § 3 — MEMBER CARD (dark background, interactive flip card)
// ═══════════════════════════════════════════════════════════════════════════

function MemberCardSection({ t }: { t: ReturnType<typeof useTranslations> }) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateXVal = ((y - centerY) / centerY) * -8;
    const rotateYVal = ((x - centerX) / centerX) * 8;
    setRotateX(rotateXVal);
    setRotateY(rotateYVal);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setRotateX(0);
    setRotateY(0);
  }, []);

  return (
    <section
      style={{ background: COLORS.dark.bg, padding: "clamp(88px, 12vw, 140px) 24px" }}
    >
      <div className="mx-auto max-w-4xl">
        <Reveal>
          <h2
            data-cms-key="memberIntro.card.title"
            className="mb-3 text-center font-bold leading-tight tracking-tight text-white"
            style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)" }}
          >
            {t("card.title")}
          </h2>
        </Reveal>

        <Reveal delay={100}>
          <p
            data-cms-key="memberIntro.card.hint"
            className="mb-12 text-center text-sm"
            style={{ color: COLORS.dark.textMuted, fontFamily: "'Good Times', sans-serif" }}
          >
            {t("card.hint")}
          </p>
        </Reveal>

        {/* Card */}
        <Reveal delay={200}>
          <div className="relative mx-auto" style={{ maxWidth: "380px", perspective: "1200px" }}>
            <button
              onClick={() => setIsFlipped(!isFlipped)}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              className="relative w-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-white/50"
              style={{
                transformStyle: "preserve-3d",
                transition: isFlipped
                  ? `transform 600ms ${EASING.pop}`
                  : 'transform 150ms ease-out',
                transform: isFlipped
                  ? "rotateY(180deg)"
                  : `perspective(1200px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`,
                aspectRatio: "1.586",
              }}
              aria-label={isFlipped ? t("card.hint") : t("card.hint")}
            >
              {/* Front */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  backfaceVisibility: "hidden",
                  background: COLORS.dark.cardBg,
                  border: `1px solid ${COLORS.dark.cardBorder}`,
                  boxShadow: "0 24px 60px rgba(0,0,0,.5)",
                  borderRadius: "20px",
                  padding: "32px",
                }}
                className="flex flex-col"
              >
                <div className="mb-6 flex items-center justify-between">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/logos/logo-white-horizontal.svg" alt="SPACE8" className="h-5 w-auto opacity-90" />
                  <div
                    className="rounded-full px-3 py-1 text-xs font-semibold text-white"
                    style={{ background: COLORS.dark.accent }}
                  >
                    MEMBER
                  </div>
                </div>
                <div className="flex flex-1 items-center justify-center">
                  <div className="text-center">
                    <p className="font-code text-xl font-semibold uppercase tracking-wide text-white">MEMBER NAME</p>
                    <p className="font-code mt-2 text-sm tracking-wide text-white/40">{DEMO_CODE}</p>
                  </div>
                </div>
              </div>

              {/* Back */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  backfaceVisibility: "hidden",
                  transform: "rotateY(180deg)",
                  background: COLORS.dark.cardBg,
                  border: `1px solid ${COLORS.dark.cardBorder}`,
                  boxShadow: "0 24px 60px rgba(0,0,0,.5)",
                  borderRadius: "20px",
                  padding: "32px",
                }}
                className="flex items-center justify-center"
              >
                <div className="rounded-xl bg-white p-4 shadow-lg">
                  <QRCodeSVG value={DEMO_CODE} size={180} level="H" />
                </div>
              </div>
            </button>

            {/* Sample label */}
            <p
              data-cms-key="memberIntro.card.sampleLabel"
              className="mt-4 text-center text-xs italic"
              style={{ color: "rgba(255,255,255,0.4)", fontFamily: "'Good Times', sans-serif" }}
            >
              {t("card.sampleLabel")}
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// § 4 — POINTS (light background, 3-column stats)
// ═══════════════════════════════════════════════════════════════════════════

function PointsSection({ t }: { t: ReturnType<typeof useTranslations> }) {
  return (
    <section style={{ background: COLORS.light.bg, padding: "clamp(88px, 12vw, 140px) 24px" }}>
      <div className="mx-auto max-w-5xl">
        <Reveal>
          <h2
            data-cms-key="memberIntro.points.title"
            className="mb-16 text-center font-bold leading-tight tracking-tight"
            style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)", color: COLORS.light.text }}
          >
            {t("points.title")}
          </h2>
        </Reveal>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-3 md:gap-0 md:divide-x md:divide-gray-200">
          {[1, 2, 3].map((n, i) => (
            <Reveal key={n} delay={i * 100}>
              <div className="flex flex-col items-center text-center md:px-8">
                <p
                  data-cms-key={`memberIntro.points.stat${n}.value`}
                  className="mb-3 text-4xl font-semibold md:text-5xl"
                  style={{ color: COLORS.light.accent }}
                >
                  {t(`points.stat${n}.value`)}
                </p>
                <p
                  data-cms-key={`memberIntro.points.stat${n}.label`}
                  className="text-sm"
                  style={{ color: COLORS.light.textMuted, fontFamily: "'Good Times', sans-serif" }}
                >
                  {t(`points.stat${n}.label`)}
                </p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={300}>
          <p
            data-cms-key="memberIntro.points.comingSoon"
            className="mt-12 text-center text-sm"
            style={{ color: COLORS.light.textMuted }}
          >
            {t("points.comingSoon")}
          </p>
        </Reveal>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// § 5 — SAFETY & SUPPORT (dark background, expandable cards)
// ═══════════════════════════════════════════════════════════════════════════

function SafetySection({ t }: { t: ReturnType<typeof useTranslations> }) {
  const [openCard, setOpenCard] = useState<number | null>(null);

  const cards = [
    { key: "pay", hasLink: false },
    { key: "data", hasLink: false },
    { key: "qr", hasLink: false },
    { key: "venue", hasLink: true, link: "/member/safety" },
  ];

  return (
    <section style={{ background: COLORS.dark.bg, padding: "clamp(88px, 12vw, 140px) 24px" }}>
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <h2
            data-cms-key="memberIntro.safety.title"
            className="mb-16 text-center font-bold leading-tight tracking-tight text-white"
            style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)" }}
          >
            {t("safety.title")}
          </h2>
        </Reveal>

        {/* Cards grid */}
        <div className="mb-16 grid grid-cols-1 gap-6 md:grid-cols-2">
          {cards.map((card, i) => {
            const isOpen = openCard === i;
            return (
              <Reveal key={card.key} delay={i * 80}>
                <button
                  onClick={() => setOpenCard(isOpen ? null : i)}
                  className="group relative w-full overflow-hidden rounded-[28px] border p-8 text-left transition-all duration-400 focus:outline-none focus:ring-2 focus:ring-white/50"
                  style={{
                    background: "#052e1f",
                    borderColor: "rgba(34, 197, 94, 0.3)",
                    minHeight: isOpen ? "auto" : "200px",
                  }}
                  aria-expanded={isOpen}
                >
                  <div className={cn("flex items-start justify-between", isOpen && "mb-6")}>
                    <h3
                      data-cms-key={`memberIntro.safety.${card.key}.title`}
                      className="pr-4 text-xl font-semibold leading-snug text-white md:text-2xl"
                    >
                      {t(`safety.${card.key}.title`)}
                    </h3>
                    <div
                      className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full transition-all duration-400"
                      style={{
                        background: "rgba(255,255,255,0.15)",
                        transform: isOpen ? "rotate(45deg)" : "rotate(0deg)",
                      }}
                    >
                      <span className="text-2xl text-white">+</span>
                    </div>
                  </div>

                  {isOpen && (
                    <div
                      className="animate-in fade-in slide-in-from-top-2 duration-400"
                      style={{ color: COLORS.dark.textMuted }}
                    >
                      {card.hasLink ? (
                        <p data-cms-key={`memberIntro.safety.${card.key}.body`} className="text-base leading-relaxed">
                          {t(`safety.${card.key}.body`)}{" "}
                          <Link
                            href={card.link!}
                            className="underline hover:text-white"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {t("safety.venue.body")}
                          </Link>
                        </p>
                      ) : (
                        <p data-cms-key={`memberIntro.safety.${card.key}.body`} className="text-base leading-relaxed">
                          {t(`safety.${card.key}.body`)}
                        </p>
                      )}
                    </div>
                  )}
                </button>
              </Reveal>
            );
          })}
        </div>

        {/* Support card */}
        <Reveal delay={320}>
          <div
            className="rounded-[28px] border p-8 md:flex md:items-center md:justify-between md:gap-8"
            style={{
              background: "rgba(255,255,255,0.03)",
              borderColor: "rgba(255,255,255,0.1)",
            }}
          >
            <div className="mb-6 md:mb-0">
              <h3
                data-cms-key="memberIntro.support.title"
                className="mb-2 text-xl font-semibold text-white md:text-2xl"
              >
                {t("support.title")}
              </h3>
              <p
                data-cms-key="memberIntro.support.body"
                className="text-sm"
                style={{ color: COLORS.dark.textMuted }}
              >
                {t("support.body")}
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row md:flex-shrink-0">
              <Link
                href="/faq"
                data-cms-key="memberIntro.support.faq"
                className="rounded-full bg-white px-6 py-3 text-center text-sm font-semibold text-black transition hover:bg-white/90"
              >
                {t("support.faq")}
              </Link>
              <a
                href="https://wa.me/85261808022"
                target="_blank"
                rel="noopener noreferrer"
                data-cms-key="memberIntro.support.whatsapp"
                className="rounded-full border border-white/30 px-6 py-3 text-center text-sm font-semibold text-white transition hover:border-white/50 hover:bg-white/5"
              >
                {t("support.whatsapp")}
              </a>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// § 6 — FINAL CTA (light background)
// ═══════════════════════════════════════════════════════════════════════════

function FinalCTASection({ t }: { t: ReturnType<typeof useTranslations> }) {
  return (
    <section style={{ background: COLORS.light.bg, padding: "clamp(88px, 12vw, 140px) 24px" }}>
      <div className="mx-auto max-w-4xl text-center">
        <Reveal>
          <h2
            data-cms-key="memberIntro.final.title"
            className="mb-10 font-bold leading-tight tracking-tight"
            style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)", color: COLORS.light.text }}
          >
            {t("final.title")}
          </h2>
        </Reveal>

        <Reveal delay={100}>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/book"
              data-cms-key="memberIntro.final.book"
              className="rounded-full px-8 py-3.5 text-base font-semibold text-white transition hover:opacity-90"
              style={{ background: COLORS.green500 }}
            >
              {t("final.book")}
            </Link>
            <Link
              href="/member"
              data-cms-key="memberIntro.final.login"
              className="group flex items-center gap-1 text-base font-medium transition hover:opacity-70"
              style={{ color: COLORS.light.text }}
            >
              <span>{t("final.login")}</span>
              <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">›</span>
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// § ROOT EXPORT
// ═══════════════════════════════════════════════════════════════════════════

export default function MembershipContentNew() {
  const t = useTranslations("memberIntro");

  return (
    <div className="bg-black text-white" data-nav-theme="dark">
      <HeroSection t={t} />
      <StatementsSection t={t} />
      <MemberCardSection t={t} />
      <PointsSection t={t} />
      <SafetySection t={t} />
      <FinalCTASection t={t} />
    </div>
  );
}
