"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { Armchair, BatteryCharging, Bot, Briefcase, DoorOpen, Lightbulb, QrCode, Sword, Table2 } from "lucide-react";
import { useTranslations } from "next-intl";

const FACILITY_IMAGES = [
  "/gallery/table-poster.jpg",
  "/gallery/Space8_Competition_Mode.PNG",
  "/gallery/Space_Infinity.PNG",
  "/gallery/Space8_Door.PNG",
  "/gallery/Space_Enternity.PNG",
  "/gallery/Space8_Competition_Mode.PNG", // placeholder: 專業桌球杆
  "/gallery/Space_Infinity.PNG",          // placeholder: 沙發休息區
  "/gallery/Space_Enternity.PNG",         // placeholder: 充電區
  "/gallery/Space8_Door.PNG",             // placeholder: 隨身物品存放
] as const;

const FACILITY_ICONS = [Table2, Lightbulb, Bot, DoorOpen, QrCode, Sword, Armchair, BatteryCharging, Briefcase] as const;
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

      {/* Horizontal scroll gallery — each card is narrower than the viewport
          so the next card naturally peeks from the right edge, signalling
          more content is available to swipe. Image container has inset
          padding + rounded corners (Apple-style inset card). */}
      <div
        ref={trackRef}
        className="no-scrollbar hscroll-track flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 md:px-6"
      >
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
              className="s2f-card"
            >
              {/* Image block — flex-[4] ≈ 80% of card height, with inset
                  padding + rounded corners so the image sits inside the card
                  with breathing room on all sides. */}
              <div className="s2f-img">
                <Image
                  src={FACILITY_IMAGES[index] ?? FACILITY_IMAGES[0]}
                  alt={facility.title}
                  fill
                  sizes="(max-width: 767px) 85vw, 380px"
                  className="object-cover"
                />
              </div>
              {/* Text block — flex-1 ≈ 20% of card height, tightly packed */}
              <div className="flex flex-[1] min-h-0 flex-col justify-center px-5 py-3">
                <Icon aria-hidden="true" size={20} strokeWidth={1.6} className="mb-1.5 text-[#1a9d5c]" />
                <h3
                  data-cms-key={`homeVenue.items.${index}.title`}
                  className="m-0 text-[15px] font-semibold leading-[1.3] text-[#111110]"
                >
                  {facility.title}
                </h3>
                <p
                  data-cms-key={`homeVenue.items.${index}.body`}
                  className="mt-1 text-[13px] leading-[1.55] text-[rgba(17,17,16,0.6)]"
                >
                  {facility.body}
                </p>
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
      <style jsx>{`
        /*
         * Card: vertical flex column — image takes flex-[4] (≈80%), text flex-1 (≈20%).
         * Image container has inset padding + rounded corners for an Apple-style
         * inset card aesthetic. Card width is slightly narrower than the viewport
         * so the next card peeks from the right edge on every breakpoint.
         */
        .s2f-card {
          display: flex;
          flex-direction: column;
          flex-shrink: 0;
          width: 85vw;
          max-width: 380px;
          height: 280px;
          scroll-snap-align: start;
          overflow: hidden;
          border-radius: 16px;
          border: 1px solid rgba(0, 0, 0, 0.08);
          background: #ffffff;
        }
        /* Image container — inset with padding, rounded corners, 80% of card height. */
        .s2f-img {
          position: relative;
          flex: 4;
          min-height: 0;
          margin: 8px;
          border-radius: 12px;
          overflow: hidden;
          background: #dcdcdc;
        }
        @media (min-width: 768px) {
          .s2f-card {
            width: 84vw;
            max-width: 380px;
            height: 480px;
          }
          .s2f-img {
            margin: 10px;
            border-radius: 14px;
          }
        }
      `}</style>
    </section>
  );
}
