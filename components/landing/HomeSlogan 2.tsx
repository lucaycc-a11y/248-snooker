"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";

const EASE = [0.16, 1, 0.3, 1] as const;

export default function HomeSlogan() {
  const t = useTranslations("homeSlogan");

  return (
    <section data-nav-theme="dark" className="bg-black px-6 py-[88px] text-white md:py-[116px]">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.25 }}
        transition={{ duration: 0.75, ease: EASE }}
        className="mx-auto max-w-4xl text-center"
      >
        <p data-cms-key="homeSlogan.eyebrow" className="mb-4 font-label text-[11px] tracking-[0.18em] text-[#22c55e]">{t("eyebrow")}</p>
        <h2 data-cms-key="homeSlogan.title" className="m-0 text-[clamp(2.5rem,8vw,5.5rem)] font-semibold tracking-[-0.05em]">{t("title")}</h2>
        <p data-cms-key="homeSlogan.subtitle" className="mx-auto mt-5 max-w-xl text-[16px] leading-[1.8] text-white/60 md:text-[19px]">{t("subtitle")}</p>
      </motion.div>
    </section>
  );
}
