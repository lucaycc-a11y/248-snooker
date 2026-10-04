"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import Velaris from "@/components/ui/velaris";
import { MemberCardPremier } from "@/app/member/components/MemberCardPremier";

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
      height="100svh"
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
              href="/login"
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
  const statements = [
    {
      lead: "HK$1 = 1 積分",
      body: "每消費 HK$1 累積 1 積分",
    },
    {
      lead: "100 積分 = HK$10",
      body: "每 100 積分可兌換 (即將推出)",
    },
    {
      lead: "100 積分",
      body: "新會員迎新獎賞",
    },
    {
      lead: "全預約制，QR 自助入場",
      body: "網上預訂，掃碼開門，簡單安全",
    },
  ];

  return (
    <section style={{ background: COLORS.light.bg, padding: "clamp(88px, 12vw, 140px) 24px" }}>
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-8 md:gap-12">
        {/* Title */}
        <Reveal>
          <h2
            data-cms-key="memberIntro.pointsProgram.title"
            className="mb-4 text-center font-bold leading-tight tracking-tight"
            style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)", color: COLORS.light.text }}
          >
            積分計劃
          </h2>
        </Reveal>

        {/* 3 columns on desktop, stacked on mobile */}
        <div className="grid w-full grid-cols-1 gap-8 md:grid-cols-3 md:gap-6">
          {statements.slice(0, 3).map((statement, i) => (
            <Reveal key={i} delay={i * 100} className="text-center">
              <div className="space-y-2">
                <p
                  data-cms-key={`memberIntro.pointsProgram.stat${i + 1}.lead`}
                  className="text-2xl font-semibold leading-tight md:text-3xl lg:text-4xl"
                  style={{ color: COLORS.light.accent }}
                >
                  {statement.lead}
                </p>
                <p
                  data-cms-key={`memberIntro.pointsProgram.stat${i + 1}.body`}
                  className="text-sm leading-relaxed md:text-base"
                  style={{ color: COLORS.light.textMuted }}
                >
                  {statement.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>

        {/* Last statement - full width below */}
        <Reveal delay={300} className="w-full text-center">
          <div
            className="mx-auto max-w-2xl rounded-3xl border p-6 md:p-8"
            style={{
              background: "rgba(255,255,255,0.6)",
              borderColor: "rgba(5,150,105,0.2)",
            }}
          >
            <p
              data-cms-key="memberIntro.pointsProgram.stat4.lead"
              className="mb-2 text-xl font-semibold leading-tight md:text-2xl lg:text-3xl"
              style={{ color: COLORS.light.accent }}
            >
              {statements[3].lead}
            </p>
            <p
              data-cms-key="memberIntro.pointsProgram.stat4.body"
              className="text-sm leading-relaxed md:text-base"
              style={{ color: COLORS.light.textMuted }}
            >
              {statements[3].body}
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// § 3 — MEMBER CARD (dark background, real card + minimal UI)
// ═══════════════════════════════════════════════════════════════════════════

function MemberCardSection({ t }: { t: ReturnType<typeof useTranslations> }) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Demo profile for card preview
  const demoProfile = {
    id: 'demo',
    display_name: 'DEMO',
    email: 'demo@space8.com.hk',
    phone: null,
    tier: 'amateur' as const,
    points: 100,
    member_code: 'SPACE8-DEMO-0000',
    unread_notifications: 0,
    gender: null,
    date_of_birth: null,
    birthday_set: false,
  };

  return (
    <section
      style={{ background: COLORS.dark.bg, padding: "clamp(88px, 12vw, 140px) 24px" }}
    >
      <div className="mx-auto max-w-4xl">
        {/* Title */}
        <Reveal>
          <h2
            data-cms-key="memberIntro.card.title"
            className="mb-12 text-center font-bold leading-tight tracking-tight text-white"
            style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)" }}
          >
            {t("card.title")}
          </h2>
        </Reveal>

        {/* Real Member Card (Demo Mode) */}
        <Reveal delay={100}>
          <MemberCardPremier profile={demoProfile} />
        </Reveal>

        {/* Description */}
        <Reveal delay={200}>
          <p
            data-cms-key="memberIntro.card.description"
            className="mt-8 text-center text-sm leading-relaxed"
            style={{ color: COLORS.dark.textMuted }}
          >
            專屬會員 QR Code。解鎖大門、登入智能小管家 Space Pilot，全部靠它。
          </p>
        </Reveal>

        {/* CTAs */}
        <Reveal delay={300}>
          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <button
              onClick={() => setIsModalOpen(true)}
              data-cms-key="memberIntro.card.learnMore"
              className="rounded-full border border-white/30 px-6 py-3 text-sm font-semibold text-white transition hover:border-white/50 hover:bg-white/5"
            >
              了解更多
            </button>
            <Link
              href="/member"
              data-cms-key="memberIntro.card.viewMyCard"
              className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition hover:bg-white/90"
            >
              查看我的會員卡
            </Link>
          </div>
        </Reveal>

        {/* QR Code Info Modal (Hidden by default) */}
        {isModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
            onClick={() => setIsModalOpen(false)}
          >
            <div
              className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border p-8"
              style={{
                background: COLORS.dark.cardBg,
                borderColor: COLORS.dark.cardBorder,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setIsModalOpen(false)}
                className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full text-2xl text-white transition hover:bg-white/10"
                aria-label="Close"
              >
                ×
              </button>

              <h3
                data-cms-key="memberIntro.qrModal.title"
                className="mb-6 text-2xl font-bold text-white md:text-3xl"
              >
                一個 QR Code，解鎖整個 SPACE8
              </h3>

              <p
                data-cms-key="memberIntro.qrModal.intro"
                className="mb-8 text-base leading-relaxed"
                style={{ color: COLORS.dark.textMuted }}
              >
                專屬會員 QR Code。解鎖大門、登入智能小管家 Space Pilot，全部靠它。你的每一場戰績，也是由它記錄下來的。
              </p>

              {/* What it does */}
              <div className="mb-8">
                <h4 className="mb-4 text-lg font-semibold text-white">這個 QR Code 能做什麼</h4>
                <div className="space-y-3">
                  {[
                    { label: "入場", desc: "解鎖大門" },
                    { label: "包廂系統", desc: "啟動 Space Pilot 智能小管家" },
                    { label: "戰績累積", desc: "記錄你的對戰紀錄" },
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div
                        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                        style={{ background: COLORS.dark.accent }}
                      >
                        {i + 1}
                      </div>
                      <div>
                        <p className="font-semibold text-white">{item.label}</p>
                        <p className="text-sm" style={{ color: COLORS.dark.textMuted }}>{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Where to find it */}
              <div>
                <h4 className="mb-4 text-lg font-semibold text-white">在哪裡找到它</h4>
                <div className="space-y-4">
                  <div>
                    <p className="mb-1 font-semibold text-white">登入會員網站</p>
                    <p className="text-sm" style={{ color: COLORS.dark.textMuted }}>
                      用手機瀏覽器開啟 www.space8.com.hk，以你的帳號登入。
                    </p>
                  </div>
                  <div>
                    <p className="mb-1 font-semibold text-white">進入會員頁面</p>
                    <p className="text-sm" style={{ color: COLORS.dark.textMuted }}>
                      登入後點選右上角頭像或「我的會員卡」，即可進入會員頁面。
                    </p>
                  </div>
                  <div>
                    <p className="mb-1 font-semibold text-white">QR Code 就在會員卡上</p>
                    <p className="text-sm" style={{ color: COLORS.dark.textMuted }}>
                      你的專屬 QR Code 顯示在網頁版會員卡右下角，也在確認已付款email 上，方便隨時查看
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
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
                      className="flex flex-shrink-0 items-center justify-center rounded-full transition-all duration-400"
                      style={{
                        width: "44px",
                        height: "44px",
                        aspectRatio: "1",
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
                            {t("safety.venue.linkText")}
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
