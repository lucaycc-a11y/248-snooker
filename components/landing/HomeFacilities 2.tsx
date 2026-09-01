"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { Bot, DoorOpen, Lightbulb, QrCode, Table2 } from "lucide-react";
import { useTranslations } from "next-intl";

const FACILITY_IMAGES = [
  "/gallery/table-poster.jpg",
  "/gallery/Space8_Competition_Mode.PNG",
  "/gallery/Space_Infinity.PNG",
  "/gallery/Space_Enternity.PNG",
  "/gallery/Space8_Door.PNG",
] as const;

const FACILITY_ICONS = [Table2, Lightbulb, Bot, DoorOpen, QrCode] as const;
const EASE = [0.16, 1, 0.3, 1] as const;

type Facility = {
  title: string;
  body: string;
};

export default function HomeFacilities() {
  const t = useTranslations("homeVenue");
  const facilities = t.raw("items") as Facility[];
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const updateActive = () => {
      const center = track.scrollLeft + track.clientWidth / 2;
      let nearest = 0;
      let distance = Number.POSITIVE_INFINITY;
      track.querySelectorAll<HTMLElement>("[data-facility-card]").forEach((card, index) => {
        const cardCenter = card.offsetLeft + card.offsetWidth / 2;
        const nextDistance = Math.abs(cardCenter - center);
        if (nextDistance < distance) {
          distance = nextDistance;
          nearest = index;
        }
      });
      setActiveIndex(nearest);
    };

    updateActive();
    track.addEventListener("scroll", updateActive, { passive: true });
    return () => track.removeEventListener("scroll", updateActive);
  }, []);

  const scrollTo = (index: number) => {
    const track = trackRef.current;
    const card = track?.querySelector<HTMLElement>(`[data-facility-card=\"${index}\"]`);
    card?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  };

  return (
    <section
      aria-labelledby="home-facilities-title"
      data-nav-theme="light"
      className="overflow-hidden bg-[#e8e8e8] px-0 py-[88px] md:py-[116px]"
    >
      <div className="mx-auto max-w-[1120px] px-6">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.7, ease: EASE }}
          className="mb-8 max-w-2xl md:mb-12"
        >
          <p data-cms-key="homeVenue.eyebrow" className="mb-3 font-label text-[12px] font-bold tracking-[0.12em] text-[#1a9d5c]">
            {t("eyebrow")}
          </p>
          <h2 id="home-facilities-title" data-cms-key="homeVenue.title" className="m-0 text-[clamp(2rem,5vw,3.5rem)] font-bold tracking-[-0.04em] text-[#111110]">
            {t("title")}
          </h2>
          <p data-cms-key="homeVenue.intro" className="mt-4 max-w-xl text-[15px] leading-[1.75] text-[rgba(17,17,16,0.6)] md:text-[17px]">
            {t("intro")}
          </p>
        </motion.div>
      </div>

      <div ref={trackRef} className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto px-6 pb-2 md:mx-auto md:grid md:max-w-[1120px] md:grid-cols-5 md:gap-4 md:overflow-visible md:px-6">
        {facilities.map((facility, index) => {
          const Icon = FACILITY_ICONS[index] ?? Table2;
          return (
            <motion.article
              key={facility.title}
              data-facility-card={index}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.15 }}
              transition={{ duration: 0.6, delay: index * 0.05, ease: EASE }}
              className="w-[78vw] shrink-0 snap-center overflow-hidden rounded-[18px] border border-black/10 bg-white md:w-auto"
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-[#dcdcdc]">
                <Image src={FACILITY_IMAGES[index] ?? FACILITY_IMAGES[0]} alt={facility.title} fill sizes="(max-width: 767px) 78vw, 220px" className="object-cover" />
              </div>
              <div className="p-5 md:p-4 lg:p-5">
                <Icon aria-hidden="true" size={24} strokeWidth={1.6} className="mb-4 text-[#1a9d5c]" />
                <h3 data-cms-key={`homeVenue.items.${index}.title`} className="m-0 text-[16px] font-bold leading-[1.4] text-[#111110]">{facility.title}</h3>
                <p data-cms-key={`homeVenue.items.${index}.body`} className="mt-2 text-[13.5px] leading-[1.75] text-[rgba(17,17,16,0.6)]">{facility.body}</p>
              </div>
            </motion.article>
          );
        })}
      </div>

      <div className="mt-7 flex justify-center gap-2 md:hidden" aria-label={t("pagination_label")}>
        {facilities.map((facility, index) => (
          <button
            key={facility.title}
            type="button"
            onClick={() => scrollTo(index)}
            aria-label={t("pagination_item", { n: index + 1 })}
            aria-current={activeIndex === index}
            className={`h-2 rounded-full border-0 p-0 transition-all ${activeIndex === index ? "w-7 bg-[#1a9d5c]" : "w-2 bg-black/25"}`}
          />
        ))}
      </div>
    </section>
  );
}
