"use client";

import { motion } from "framer-motion";
import { Focus, MonitorSmartphone, Table2 } from "lucide-react";
import { useTranslations } from "next-intl";

const ICONS = [Focus, MonitorSmartphone, Table2] as const;
const EASE = [0.16, 1, 0.3, 1] as const;

type FocusItem = {
  title: string;
  body: string;
};

export default function HomeFocus() {
  const t = useTranslations("homeFocus");
  const items = t.raw("items") as FocusItem[];

  return (
    <section
      aria-labelledby="home-focus-title"
      data-nav-theme="light"
      className="bg-[#f5f5f7] px-6 py-[88px] text-[#1d1d1f] md:py-[116px]"
    >
      <div className="mx-auto max-w-[1120px]">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.7, ease: EASE }}
          className="mb-8 max-w-2xl md:mb-12"
        >
          <p data-cms-key="homeFocus.eyebrow" className="mb-3 font-label text-[12px] font-bold tracking-[0.14em] text-[#1a9d5c]">
            {t("eyebrow")}
          </p>
          <h2 id="home-focus-title" data-cms-key="homeFocus.title" className="m-0 text-[clamp(2rem,5vw,3.5rem)] font-bold tracking-[-0.04em]">
            {t("title")}
          </h2>
        </motion.div>

        <div className="grid gap-4 md:grid-cols-3">
          {items.map((item, index) => {
            const Icon = ICONS[index] ?? Focus;
            return (
              <motion.article
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.15 }}
                transition={{ duration: 0.65, delay: index * 0.08, ease: EASE }}
                className="rounded-[18px] border border-black/10 bg-white p-6 md:p-7"
              >
                <Icon aria-hidden="true" size={28} strokeWidth={1.5} className="mb-6 text-[#1a9d5c]" />
                <h3 data-cms-key={`homeFocus.items.${index}.title`} className="m-0 text-[20px] font-bold tracking-[-0.02em]">
                  {item.title}
                </h3>
                <p data-cms-key={`homeFocus.items.${index}.body`} className="mt-3 text-[15px] leading-[1.75] text-black/60">
                  {item.body}
                </p>
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
