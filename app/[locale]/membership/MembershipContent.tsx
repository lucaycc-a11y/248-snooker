"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { QRCodeSVG } from "qrcode.react";

// ─── design tokens (matches 924_member_guide.html) ──────────────────────────
const GREEN      = "#22C55E";
const GREEN_INK  = "#15803D";
const FELT       = "#0B5D34";
const FELT_DEEP  = "#073D22";
const MUTED      = "#8A918B";
const BORDER     = "rgba(255,255,255,0.10)";

// Demo member code for the static QR explainer — not real user data
const DEMO_CODE = "SP8-DEMO-0000";

type Translation = ReturnType<typeof useTranslations>;
type UseItem = { tag: string; title: string };
type StepItem = { title: string; body: string };

// ─── shared fade-up reveal ───────────────────────────────────────────────────
function Reveal({ children, index = 0 }: { children: React.ReactNode; index?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.5, delay: index * 0.07, ease: [0.2, 0.7, 0.3, 1] }}
      className="motion-reduce:!transform-none motion-reduce:!opacity-100"
    >
      {children}
    </motion.div>
  );
}

// ─── tier definitions ────────────────────────────────────────────────────────
const TIERS = [
  {
    key:        "tier_new",
    multiplier: "1X",
    isTop:      false,
  },
  {
    key:        "tier_platinum",
    multiplier: "1.5X",
    isTop:      false,
  },
  {
    key:        "tier_diamond",
    multiplier: "2X",
    isTop:      true,                 // green felt treatment
  },
] as const;

// ════════════════════════════════════════════════════════════════════════════
// § 1 — TIER LADDER
//   Horizontal progress line connects 3 threshold nodes. Top tier (index 2)
//   gets radial-gradient felt background matching 924_member_guide.html.
// ════════════════════════════════════════════════════════════════════════════

function TierLadder({ t }: { t: Translation }) {
  return (
    <section id="membership-tiers" className="pb-16 pt-20 md:pb-24 md:pt-28">
      {/* Section heading */}
      <Reveal>
        <h2
          data-cms-key="membershipHub.tier_title"
          className="mb-3 text-center text-3xl font-semibold tracking-tight text-white md:text-5xl"
        >
          {t("tier_title")}
        </h2>
        <p className="mx-auto mb-12 max-w-xl text-center text-base leading-7 text-white/55">
          {t("tier_intro")}
        </p>
      </Reveal>

      {/* Ladder progress line + nodes */}
      <Reveal>
        <div className="relative mb-0 hidden md:block">
          {/* Horizontal gradient line */}
          <div
            className="absolute left-0 right-0 top-1/2 -translate-y-1/2"
            style={{
              height: 2,
              background: `linear-gradient(to right, rgba(255,255,255,.10), ${GREEN} 50%, ${GREEN} 100%)`,
            }}
          />
          <div className="grid grid-cols-3">
            {TIERS.map((tier, i) => {
              const at: string = t(`${tier.key}.at`);
              const threshold: string = t(`${tier.key}.threshold`);
              return (
                <div key={tier.key} className="flex flex-col items-center gap-2 pb-6">
                  {/* Circle node */}
                  <div
                    className="relative z-10 flex h-5 w-5 items-center justify-center rounded-full"
                    style={{
                      background: i === 0 ? "rgba(255,255,255,.18)" : GREEN,
                      boxShadow: i > 0 ? `0 0 12px ${GREEN}99` : "none",
                    }}
                  >
                    <div className="h-2 w-2 rounded-full bg-white" />
                  </div>
                  {/* Threshold label */}
                  {threshold ? (
                    <span
                      className="text-xs font-semibold"
                      style={{ color: GREEN, letterSpacing: "0.05em" }}
                    >
                      {threshold}
                    </span>
                  ) : (
                    <span className="text-xs text-white/30">—</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </Reveal>

      {/* Tier cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {TIERS.map((tier, i) => (
          <TierCard key={tier.key} tierKey={tier.key} multiplier={tier.multiplier} isTop={tier.isTop} index={i} t={t} />
        ))}
      </div>

      {/* CTAs */}
      <Reveal index={4}>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link
            href="/book"
            className="rounded-full px-6 py-3 text-sm font-semibold transition hover:opacity-90"
            style={{ background: GREEN, color: "#07130d" }}
          >
            {t("cta_book")}
          </Link>
          <Link
            href="/login"
            className="rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white transition hover:border-[#22C55E] hover:text-[#86efac]"
          >
            {t("cta_login")}
          </Link>
        </div>
      </Reveal>
    </section>
  );
}

function TierCard({
  tierKey, multiplier, isTop, index, t,
}: {
  tierKey: string;
  multiplier: string;
  isTop: boolean;
  index: number;
  t: Translation;
}) {
  const title: string     = t(`${tierKey}.title`);
  const threshold: string = t(`${tierKey}.threshold`);
  const lead: string      = t(`${tierKey}.lead`);
  const desc: string      = t(`${tierKey}.desc`);

  const surface = isTop
    ? `radial-gradient(140% 100% at 20% 0%, ${FELT} 0%, ${FELT_DEEP} 50%, rgba(7,61,34,.25) 100%)`
    : "rgba(255,255,255,0.025)";
  const border  = isTop ? `1px solid ${GREEN}55` : `1px solid ${BORDER}`;
  const mulColor = isTop ? GREEN : "rgba(255,255,255,0.55)";

  return (
    <Reveal index={index}>
      <article
        className="flex h-full flex-col rounded-2xl p-7 transition duration-300 hover:-translate-y-1"
        style={{ background: surface, border }}
      >
        {/* Large multiplier — Good Times / font-code */}
        <p
          className="font-code leading-none"
          style={{ fontSize: "clamp(64px,8vw,100px)", color: mulColor, opacity: 0.9 }}
          aria-label={`積分倍率 ${multiplier}`}
        >
          {multiplier}
        </p>

        <h3
          data-cms-key={`membershipHub.${tierKey}.title`}
          className="mt-5 text-2xl font-semibold text-white"
        >
          {title}
        </h3>

        {threshold ? (
          <p className="mt-1 text-sm font-medium" style={{ color: GREEN }}>
            {threshold}
          </p>
        ) : null}

        <p
          data-cms-key={`membershipHub.${tierKey}.lead`}
          className="mt-4 text-sm font-semibold leading-6 text-white/80"
        >
          {lead}
        </p>

        <p
          data-cms-key={`membershipHub.${tierKey}.desc`}
          className="mt-3 flex-1 text-sm leading-6"
          style={{ color: MUTED }}
        >
          {desc}
        </p>
      </article>
    </Reveal>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// § 2 — POINTS FLOW  (4-step numbered circles with horizontal connectors)
// ════════════════════════════════════════════════════════════════════════════

type FlowItem = { title: string; body: string };

function FlowSection({
  id, sectionTitle, items, cmsKey,
}: {
  id?: string;
  sectionTitle: string;
  items: FlowItem[];
  cmsKey: string;
}) {
  return (
    <section id={id} className="border-t border-white/10 pb-16 pt-20 md:pb-24 md:pt-28">
      <Reveal>
        <h2
          data-cms-key={cmsKey}
          className="mb-14 text-center text-3xl font-semibold tracking-tight text-white md:text-5xl"
        >
          {sectionTitle}
        </h2>
      </Reveal>

      {/* Desktop: horizontal flow with connector lines */}
      <div className="hidden md:block">
        <Reveal>
          <div className="relative grid grid-cols-4 gap-0">
            {/* Connector line */}
            <div
              className="absolute left-[12.5%] right-[12.5%] top-[22px] -translate-y-1/2"
              style={{ height: 1, background: `linear-gradient(to right, transparent, ${GREEN}66, transparent)` }}
            />
            {items.map((item, i) => (
              <div key={item.title} className="flex flex-col items-center gap-5 px-4 text-center">
                <div
                  className="relative z-10 flex h-11 w-11 items-center justify-center rounded-full font-code text-sm font-bold text-white"
                  style={{ background: GREEN, boxShadow: `0 0 20px ${GREEN}55` }}
                >
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6" style={{ color: MUTED }}>{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </div>

      {/* Mobile: vertical list */}
      <ol className="space-y-0 md:hidden">
        {items.map((item, i) => (
          <Reveal key={item.title} index={i}>
            <li className="flex gap-5 pb-8 last:pb-0">
              <div className="flex flex-col items-center">
                <div
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full font-code text-sm font-bold text-white"
                  style={{ background: GREEN, boxShadow: `0 0 16px ${GREEN}55` }}
                >
                  {String(i + 1).padStart(2, "0")}
                </div>
                {i < items.length - 1 && (
                  <div className="mt-2 w-px flex-1 bg-white/10" />
                )}
              </div>
              <div className="pt-2">
                <h3 className="text-base font-semibold text-white">{item.title}</h3>
                <p className="mt-2 text-sm leading-6" style={{ color: MUTED }}>{item.body}</p>
              </div>
            </li>
          </Reveal>
        ))}
      </ol>
    </section>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// § 3 — QR ACCESS SECTION  (white "paper" background, 2-col layout)
//   Left:  section heading + icon use-list + tips
//   Right: demo member card + steps + 2 CTAs
// ════════════════════════════════════════════════════════════════════════════

function QRSection({ t }: { t: Translation }) {
  const uses  = t.raw("qr_uses")  as UseItem[];
  const steps = t.raw("qr_steps") as StepItem[];
  const tips  = t.raw("qr_tips")  as string[];

  return (
    <section
      id="member-qr"
      className="scroll-mt-24 border-t border-white/10"
    >
      {/* Paper panel — light background matching reference .paper */}
      <div
        className="rounded-3xl px-6 py-14 md:px-12 md:py-20"
        style={{ background: "#F4F4F6", color: "#141614" }}
      >
        <Reveal>
          <h2
            data-cms-key="membershipHub.qr_title"
            className="mb-12 text-center text-3xl font-semibold tracking-tight md:text-5xl"
            style={{ color: "#141614" }}
          >
            {t("qr_title")}
          </h2>
        </Reveal>

        <div className="grid gap-12 md:grid-cols-2 md:gap-16 md:items-start">

          {/* ── LEFT COLUMN ─────────────────────────────────────── */}
          <div className="space-y-10">

            {/* What the QR does — icon list */}
            <div>
              <h3
                data-cms-key="membershipHub.qr_s1"
                className="mb-5 text-lg font-semibold"
                style={{ color: "#141614" }}
              >
                {t("qr_s1")}
              </h3>
              <ul className="space-y-3">
                {uses.map((u, i) => (
                  <Reveal key={i} index={i}>
                    <li className="flex items-center gap-4">
                      <span
                        className="flex-shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold"
                        style={{ background: GREEN_INK, color: "#fff" }}
                      >
                        {u.tag}
                      </span>
                      <span className="text-sm font-medium" style={{ color: "#141614" }}>
                        {u.title}
                      </span>
                    </li>
                  </Reveal>
                ))}
              </ul>
            </div>

            {/* Tips */}
            <div>
              <h3
                data-cms-key="membershipHub.qr_s3"
                className="mb-4 text-lg font-semibold"
                style={{ color: "#141614" }}
              >
                {t("qr_s3")}
              </h3>
              <ul className="space-y-2">
                {tips.map((tip, i) => (
                  <Reveal key={i} index={i}>
                    <li className="flex gap-3 text-sm leading-6" style={{ color: "#5B625C" }}>
                      <span className="mt-[5px] h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: GREEN }} />
                      {tip}
                    </li>
                  </Reveal>
                ))}
              </ul>
            </div>
          </div>

          {/* ── RIGHT COLUMN ────────────────────────────────────── */}
          <div className="space-y-8">

            {/* Demo member card */}
            <Reveal>
              <div
                className="mx-auto w-full max-w-[320px] overflow-hidden rounded-[20px]"
                style={{
                  background: "linear-gradient(150deg,#2B3039 0%,#1B1E24 55%,#23272F 100%)",
                  border: "1px solid rgba(255,255,255,.12)",
                  boxShadow: "0 24px 60px rgba(0,0,0,.35)",
                }}
              >
                <div className="p-6">
                  <div className="mb-4 flex items-center justify-between">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/logos/logo-white-horizontal.svg" alt="" className="h-4 w-auto opacity-90" />
                    <div
                      className="rounded-full px-3 py-1 text-xs font-semibold text-white"
                      style={{ background: "linear-gradient(180deg,#A2AEC4,#7F8BA2)" }}
                    >
                      {t("tier_new.title")}
                    </div>
                  </div>
                  <div className="flex justify-center">
                    <div className="rounded-xl bg-white p-3 shadow-lg">
                      <QRCodeSVG value={DEMO_CODE} size={130} level="H" />
                    </div>
                  </div>
                  <div className="mt-4 space-y-1 text-center">
                    <p className="font-code text-base font-semibold uppercase tracking-wide text-white">MEMBER NAME</p>
                    <p className="font-code text-xs tracking-[0.06em] text-white/45">{DEMO_CODE}</p>
                  </div>
                </div>
              </div>
              <p
                data-cms-key="membershipHub.qr_placeholder"
                className="mt-3 text-center text-xs italic"
                style={{ color: "#8A918B" }}
              >
                {t("qr_placeholder")}
              </p>
            </Reveal>

            {/* How to find it — steps */}
            <div>
              <h3
                data-cms-key="membershipHub.qr_s2"
                className="mb-5 text-lg font-semibold"
                style={{ color: "#141614" }}
              >
                {t("qr_s2")}
              </h3>
              <ol className="space-y-5">
                {steps.map((step, i) => (
                  <Reveal key={i} index={i}>
                    <li className="flex gap-4">
                      <div
                        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                        style={{ background: GREEN_INK }}
                      >
                        {i + 1}
                      </div>
                      <div>
                        <p className="text-sm font-semibold" style={{ color: "#141614" }}>{step.title}</p>
                        <p className="mt-1 text-sm leading-6" style={{ color: "#5B625C" }}>{step.body}</p>
                      </div>
                    </li>
                  </Reveal>
                ))}
              </ol>
            </div>

            {/* CTAs */}
            <Reveal index={4}>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/member"
                  className="flex-1 rounded-full py-3 text-center text-sm font-semibold text-white transition hover:opacity-90"
                  style={{ background: GREEN_INK }}
                  data-cms-key="membershipHub.qr_cta"
                >
                  {t("qr_cta")}
                </Link>
                <Link
                  href="/member"
                  className="flex-1 rounded-full border py-3 text-center text-sm font-semibold transition hover:border-[#15803D]"
                  style={{ borderColor: "#C8D5C9", color: "#141614" }}
                  data-cms-key="membershipHub.qr_cta_record"
                >
                  {t("qr_cta_record")}
                </Link>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// § ROOT EXPORT
// ════════════════════════════════════════════════════════════════════════════

export default function MembershipContent() {
  const t = useTranslations("membershipHub");

  const howItems   = t.raw("how_items")   as FlowItem[];
  const pilotItems = t.raw("pilot_items") as FlowItem[];

  return (
    <div className="bg-black text-white" data-nav-theme="dark">
      <div className="mx-auto max-w-6xl px-5 md:px-8">
        <TierLadder t={t} />
        <FlowSection
          sectionTitle={t("how_title")}
          items={howItems}
          cmsKey="membershipHub.how_title"
        />
        <div className="py-12 md:py-16">
          <QRSection t={t} />
        </div>
        <FlowSection
          id="smart-concierge"
          sectionTitle={t("pilot_title")}
          items={pilotItems}
          cmsKey="membershipHub.pilot_title"
        />
      </div>
    </div>
  );
}
