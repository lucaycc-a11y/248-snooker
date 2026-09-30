"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { AppleCarouselCentered } from "@/components/ui/apple-cards-carousel-centered";

const FACILITY_IMAGES = [
  "/images/pool-table-closeup-中八桌球-香港新蒲崗.webp",
  "/images/pool-table-closeup-2-中八桌球-香港新蒲崗.webp",
  "/gallery/spacepliot.png",
  "/images/qrcode-checkin-中八桌球-香港新蒲崗.webp",
] as const;

const FACILITY_CATEGORIES = [
  "categories.equipment",
  "categories.ambience",
  "categories.smart_system",
  "categories.entry",
] as const;

const FACILITY_ALT_CMS_KEYS = [
  "homeVenue.items.0.alt",
  "homeVenue.items.1.alt",
  "homeVenue.items.2.alt",
  "homeVenue.items.3.alt",
] as const;

type Facility = {
  title: string;
  body: string;
};

export default function HomeFacilities() {
  const t = useTranslations("homeVenue");
  const tSpacePilot = useTranslations("spacePilot");
  const facilities = t.raw("items") as Facility[];
  // Only use first 4 items (exclude charging and storage)
  const visibleFacilities = facilities.slice(0, 4);

  const slides = visibleFacilities.map((facility, index) => ({
    eyebrow: t(FACILITY_CATEGORIES[index] ?? FACILITY_CATEGORIES[0]),
    title: facility.title,
    desc: facility.body,
    detailedDesc: index === 2
      ? "**Space Pilot 智能小管家**：掃碼報到、AI 推薦最公平的賽制、大螢幕即時比分，**每一場勝負記入戰績**，方便之後查看。"
      : facility.body,
    src: FACILITY_IMAGES[index] ?? FACILITY_IMAGES[0],
    alt: facility.title,
    altCmsKey: FACILITY_ALT_CMS_KEYS[index],
    focus: "center" as const,
    width: 420,
    height: 560,
    // SpacePilot screenshot is 4269×2400 (landscape 16:9) — wider card, contain fit on dark bg
    aspectRatio: index === 2 ? "16 / 9" : undefined,
    objectFit: (index === 2 ? "contain" : "cover") as "contain" | "cover",
    badge: index === 2 ? tSpacePilot("stat_main") : undefined,
    darkTheme: index === 2,
  }));

  return (
    <section
      aria-labelledby="home-facilities-title"
      data-nav-theme="light"
      className="overflow-x-clip bg-[#f5f5f7] px-0 py-24 md:py-32 pt-[calc(var(--nav-h,4rem)+2rem)] min-h-[100svh] flex flex-col justify-center"
    >
      <div className="mb-12 px-6 md:px-16">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          <h2 id="home-facilities-title" data-cms-key="homeVenue.title" className="sr-only">
            {t("title")}
          </h2>
          <p data-cms-key="homeVenue.intro" className="m-0 max-w-4xl text-[clamp(1.75rem,4vw,3.25rem)] font-semibold leading-[1.02] tracking-[-0.04em] text-[#111110]">
            {t("intro")}
          </p>
        </motion.div>
      </div>

      <AppleCarouselCentered
        slides={slides}
        autoplayInterval={5000}
        aspectRatio="3 / 4"
        viewDetailsLabel={t("viewDetails")}
        closeLabel={t("close")}
      />
    </section>
  );
}
