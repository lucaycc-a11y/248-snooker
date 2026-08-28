"use client";

import { motion } from "framer-motion";
import { BrainCircuit, MonitorPlay, Trophy, Video } from "lucide-react";
import { useTranslations } from "next-intl";
import { useAnimeReveal } from "@/lib/anime-reveal";

const ICONS = [BrainCircuit, MonitorPlay, Trophy, Video] as const;
const EASE = [0.16, 1, 0.3, 1] as const;

type SpacePilotFeature = {
  title: string;
  body: string;
};

export default function SpacePilotHomepage() {
  const t = useTranslations("spacePilot");
  const revealRef = useAnimeReveal<HTMLElement>({
    selector: "[data-anime-pilot-item]",
    delay: 75,
    duration: 720,
    distance: 18,
  });
  const features = t.raw("features") as SpacePilotFeature[];

  return (
    <section
      ref={revealRef}
      aria-labelledby="space-pilot-title"
      data-nav-theme="light"
      className="bg-[#f5f5f5] px-6 py-[88px] text-[#1d1d1f] md:py-[116px]"
    >
      <div className="mx-auto max-w-[1120px]">
        <motion.div
          data-anime-pilot-item
          initial={{ opacity: 1, y: 0 }}
          className="mb-8 max-w-3xl md:mb-12"
        >
          <p data-anime-pilot-item data-cms-key="spacePilot.eyebrow" className="mb-3 font-label text-[11px] font-bold tracking-[0.16em] text-[#1a9d5c]">
            {t("eyebrow")}
          </p>
          <h2 data-anime-pilot-item id="space-pilot-title" data-cms-key="spacePilot.title" className="m-0 text-[clamp(2rem,5vw,4rem)] font-bold leading-[1.08] tracking-[-0.04em]">
            {t("title")}
          </h2>
          <p data-anime-pilot-item data-cms-key="spacePilot.intro" className="mt-5 max-w-2xl text-[16px] leading-[1.75] text-black/60 md:text-[18px]">
            {t("intro")}
          </p>
        </motion.div>

        <div className="grid gap-4 md:grid-cols-2">
          {features.map((feature, index) => {
            const Icon = ICONS[index] ?? BrainCircuit;
            return (
              <motion.article
                data-anime-pilot-item
                key={feature.title}
                initial={{ opacity: 1, y: 0 }}
                className="rounded-[20px] border border-black/10 bg-white p-6 transition-transform duration-300 hover:-translate-y-1 md:p-8"
              >
                <Icon aria-hidden="true" size={30} strokeWidth={1.5} className="mb-6 text-[#1a9d5c]" />
                <h3 data-cms-key={`spacePilot.features.${index}.title`} className="m-0 text-[21px] font-bold tracking-[-0.02em]">
                  {feature.title}
                </h3>
                <p data-cms-key={`spacePilot.features.${index}.body`} className="mt-3 text-[15px] leading-[1.75] text-black/60">
                  {feature.body}
                </p>
              </motion.article>
            );
          })}
        </div>

        <motion.div
          data-anime-pilot-item
          initial={{ opacity: 1, y: 0 }}
          className="mt-8 rounded-[20px] border border-black/10 bg-[#e8e8e8] p-6 md:mt-10 md:p-8"
        >
          <h3 data-cms-key="spacePilot.space_title" className="m-0 text-[clamp(1.5rem,3vw,2.25rem)] font-bold tracking-[-0.03em]">
            {t("space_title")}
          </h3>
          <p data-cms-key="spacePilot.space_subtitle" className="mt-3 text-[15px] leading-[1.75] text-black/60 md:text-[17px]">
            {t("space_subtitle")}
          </p>
        </motion.div>

        <motion.a
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6, delay: 0.16, ease: EASE }}
          href="#"
          data-todo="Replace # with the Space Pilot detail page when it exists."
          data-cms-key="spacePilot.more"
          className="mt-8 inline-flex min-h-11 items-center rounded-full border border-[#1a9d5c] px-5 py-3 text-[15px] font-semibold text-[#1a9d5c] transition-colors hover:bg-[#1a9d5c] hover:text-white md:mt-10"
        >
          {t("more")}
          <span aria-hidden="true" className="ml-2">→</span>
        </motion.a>
      </div>
    </section>
  );
}
