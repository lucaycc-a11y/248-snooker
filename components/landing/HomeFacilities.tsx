"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { AppleCarousel } from "@/components/ui/apple-cards-carousel";

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

type Facility = {
  title: string;
  body: string;
};

export default function HomeFacilities() {
  const t = useTranslations("homeVenue");
  const facilities = t.raw("items") as Facility[];
  // Only use first 4 items (exclude charging and storage)
  const visibleFacilities = facilities.slice(0, 4);

  const slides = visibleFacilities.map((facility, index) => ({
    eyebrow: t(FACILITY_CATEGORIES[index] ?? FACILITY_CATEGORIES[0]),
    title: facility.title,
    desc: facility.body,
    src: FACILITY_IMAGES[index] ?? FACILITY_IMAGES[0],
    alt: facility.title,
    focus: "center" as const,
  }));

  return (
    <section
      aria-labelledby="home-facilities-title"
      data-nav-theme="light"
      className="overflow-x-clip bg-[#f5f5f7] px-0 py-24 md:py-32"
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

      <AppleCarousel
        slides={slides}
        autoplayInterval={5000}
        aspectRatio="3 / 4"
      />
    </section>
  );
}
