"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

const GREEN = "#22b86b";
const GREEN_DEEP = "#0f7845";
const BORDER = "rgba(255,255,255,0.12)";

type Translation = ReturnType<typeof useTranslations>;
type Item = { title: string; body: string };

function Reveal({ children, index = 0 }: { children: React.ReactNode; index?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.18 }}
      transition={{ duration: 0.55, delay: index * 0.07, ease: [0.2, 0.7, 0.3, 1] }}
      className="motion-reduce:!transform-none motion-reduce:!opacity-100"
    >
      {children}
    </motion.div>
  );
}

function SectionHeading({ title, intro, cmsKey }: { title: string; intro?: string; cmsKey: string }) {
  return (
    <div className="mx-auto mb-10 max-w-2xl text-center">
      <h2 data-cms-key={cmsKey} className="text-3xl font-semibold tracking-tight text-white md:text-5xl">{title}</h2>
      {intro && <p className="mt-4 text-base leading-7 text-white/65">{intro}</p>}
    </div>
  );
}

function InfoCard({ item, index }: { item: Item; index: number }) {
  return (
    <Reveal index={index}>
      <article className="group h-full rounded-2xl border p-6 transition duration-300 hover:-translate-y-1 hover:border-[#22b86b]/70 hover:bg-white/[0.06]" style={{ borderColor: BORDER, background: "rgba(255,255,255,0.025)" }}>
        <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-xl bg-[#22b86b]/15 text-sm font-semibold text-[#22b86b]">{String(index + 1).padStart(2, "0")}</div>
        <h3 className="text-lg font-semibold text-white">{item.title}</h3>
        <p className="mt-3 text-sm leading-7 text-white/65">{item.body}</p>
      </article>
    </Reveal>
  );
}

function TierCard({
  title,
  subtitle,
  body,
  desc,
  index,
}: {
  title: string;
  subtitle?: string;
  body: string;
  desc: string;
  index: number;
}) {
  const tierKey = index === 0 ? "tier_new" : index === 1 ? "tier_platinum" : "tier_diamond";

  return (
    <Reveal index={index}>
      <article className="h-full rounded-2xl border p-7 transition duration-300 hover:-translate-y-1 hover:border-[#22b86b]/70" style={{ borderColor: BORDER, background: index === 2 ? `linear-gradient(145deg, ${GREEN_DEEP}55, rgba(255,255,255,0.035))` : "rgba(255,255,255,0.025)" }}>
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#22b86b]">{index === 0 ? "1x" : index === 1 ? "1.5x" : "2x"}</p>
        <h3 data-cms-key={`membershipHub.${tierKey}.title`} className="mt-5 text-2xl font-semibold text-white">{title}</h3>
        {subtitle && <p className="mt-2 text-sm font-medium text-[#86efac]">{subtitle}</p>}
        <p data-cms-key={`membershipHub.${tierKey}.body`} className="mt-5 text-base leading-7 text-white/80">{body}</p>
        <p data-cms-key={`membershipHub.${tierKey}.desc`} className="mt-4 text-sm leading-6 text-white/55">{desc}</p>
      </article>
    </Reveal>
  );
}

function MembershipSection({ t }: { t: Translation }) {
  return (
    <section id="membership-tiers" className="pt-20 pb-12 md:py-28">
      <SectionHeading title={t("tier_title")} intro={t("tier_intro")} cmsKey="membershipHub.tier_title" />
      <p className="mx-auto mb-10 max-w-2xl rounded-xl border border-[#22b86b]/35 bg-[#22b86b]/10 px-5 py-4 text-center text-sm font-medium leading-6 text-[#b9f6c9]">{t("tier_join_note")}</p>
      <div className="grid gap-4 md:grid-cols-3">
        <TierCard index={0} title={t("tier_new.title")} body={t("tier_new.body")} desc={t("tier_new.desc")} />
        <TierCard index={1} title={t("tier_platinum.title")} subtitle={t("tier_platinum.subtitle")} body={t("tier_platinum.body")} desc={t("tier_platinum.desc")} />
        <TierCard index={2} title={t("tier_diamond.title")} subtitle={t("tier_diamond.subtitle")} body={t("tier_diamond.body")} desc={t("tier_diamond.desc")} />
      </div>
      <div className="mt-12 flex flex-wrap justify-center gap-3">
        <Link href="/book" className="rounded-full bg-[#22b86b] px-6 py-3 text-sm font-semibold text-[#07130d] transition hover:bg-[#86efac]">{t("cta_book")}</Link>
        <Link href="/login" className="rounded-full border border-white/25 px-6 py-3 text-sm font-semibold text-white transition hover:border-[#22b86b] hover:text-[#86efac]">{t("cta_login")}</Link>
      </div>
    </section>
  );
}

function PointsSection({ t }: { t: Translation }) {
  const items = t.raw("how_items") as Item[];
  return (
    <section className="border-t border-white/10 pt-20 pb-12 md:py-28">
      <SectionHeading title={t("how_title")} cmsKey="membershipHub.how_title" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{items.map((item, index) => <InfoCard key={item.title} item={item} index={index} />)}</div>
    </section>
  );
}

function EntryGuideSection({ t }: { t: Translation }) {
  return (
    <section id="entry-guide" className="border-t border-white/10 pt-20 pb-12 scroll-mt-24 md:py-28">
      <SectionHeading title={t("entry_title")} cmsKey="membershipHub.entry_title" />
      <Reveal>
        <article className="mx-auto max-w-2xl rounded-2xl border p-7 text-center" style={{ borderColor: BORDER, background: "rgba(255,255,255,0.025)" }}>
          <p data-cms-key="membershipHub.entry_body" className="text-base leading-7 text-white/70">{t("entry_body")}</p>
        </article>
      </Reveal>
    </section>
  );
}

function PilotSection({ t }: { t: Translation }) {
  const items = t.raw("pilot_items") as Item[];
  return (
    <section id="smart-concierge" className="border-t border-white/10 pt-20 pb-12 md:py-28">
      <SectionHeading title={t("pilot_title")} intro={t("pilot_intro")} cmsKey="membershipHub.pilot_title" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{items.map((item, index) => <InfoCard key={item.title} item={item} index={index} />)}</div>
    </section>
  );
}

export default function MembershipContent() {
  const t = useTranslations("membershipHub");
  return (
    <div className="bg-black text-white">
      <main className="mx-auto max-w-6xl px-5 md:px-8">
        <MembershipSection t={t} />
        <PointsSection t={t} />
        <EntryGuideSection t={t} />
        <PilotSection t={t} />
      </main>
    </div>
  );
}
