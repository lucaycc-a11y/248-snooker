"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";

const ROOM_IMAGES = [
  "/gallery/Space_Infinity.PNG",
  "/gallery/Space_Enternity.PNG",
] as const;
const EASE = [0.16, 1, 0.3, 1] as const;

type Room = {
  title: string;
  subtitle: string;
};

export default function HomeRooms() {
  const t = useTranslations("homeRooms");
  const rooms = t.raw("items") as Room[];

  return (
    <section
      aria-labelledby="home-rooms-title"
      data-nav-theme="dark"
      className="bg-[#1d1d1f] px-6 py-[76px] text-white md:py-[92px]"
    >
      <div className="mx-auto max-w-[1120px]">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.7, ease: EASE }}
          className="mb-8 max-w-2xl md:mb-10"
        >
          <p data-cms-key="homeRooms.eyebrow" className="mb-3 font-label text-[12px] font-bold tracking-[0.14em] text-[#22c55e]">
            {t("eyebrow")}
          </p>
          <h2 id="home-rooms-title" data-cms-key="homeRooms.title" className="m-0 text-[clamp(2rem,5vw,3.5rem)] font-bold tracking-[-0.04em]">
            {t("title")}
          </h2>
          <p data-cms-key="homeRooms.body" className="mt-4 max-w-2xl text-[15px] leading-[1.8] text-white/65 md:text-[17px]">
            {t("body")}
          </p>
        </motion.div>

        <div className="grid gap-4 md:grid-cols-2">
          {rooms.map((room, index) => (
            <motion.article
              key={room.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.15 }}
              transition={{ duration: 0.65, delay: index * 0.08, ease: EASE }}
              className="overflow-hidden rounded-[18px] border border-white/15 bg-black/20"
            >
              <div className="relative aspect-[16/9] overflow-hidden">
                <Image src={ROOM_IMAGES[index] ?? ROOM_IMAGES[0]} alt={room.title} fill sizes="(max-width: 767px) 100vw, 50vw" className="object-cover" />
              </div>
              <div className="p-5 md:p-6">
                <p data-cms-key={`homeRooms.items.${index}.subtitle`} className="m-0 font-label text-[11px] tracking-[0.12em] text-white/45">{room.subtitle}</p>
                <h3 data-cms-key={`homeRooms.items.${index}.title`} className="mt-2 text-xl font-semibold tracking-[-0.02em]">{room.title}</h3>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
