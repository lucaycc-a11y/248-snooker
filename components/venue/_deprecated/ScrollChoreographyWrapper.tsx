"use client";

import { useTranslations } from "next-intl";
import ScrollChoreography from "./ScrollChoreography";

interface ScrollChoreographyWrapperProps {
  className?: string;
}

export default function ScrollChoreographyWrapper({
  className,
}: ScrollChoreographyWrapperProps) {
  const t = useTranslations();

  const images = {
    topLeft: {
      src: "/images/venue/space-eternity.jpg",
      alt: t("venueHero.alt_topLeft") || "Space Eternity room",
      objectPosition: "center",
    },
    topRight: {
      src: "/images/venue/space-infinity.jpg",
      alt: t("venueHero.alt_topRight") || "Space Infinity room",
      objectPosition: "center",
    },
    bottomLeft: {
      src: "/images/venue/lounge.jpg",
      alt: t("venueHero.alt_bottomLeft") || "Lounge area",
      objectPosition: "center",
    },
    bottomRight: {
      src: "/images/venue/atmosphere.jpg",
      alt: t("venueHero.alt_bottomRight") || "Atmosphere and lighting",
      objectPosition: "center",
    },
  };

  const overlay = (
    <div className="w-full max-w-xl">
      <div className="text-xs font-semibold tracking-widest text-white/60 uppercase mb-3">
        {t("venueHero.eyebrow")}
      </div>
      <h1 className="text-4xl md:text-5xl font-black text-white mb-4 leading-tight">
        {t("venueHero.title")}
      </h1>
      <p className="text-sm md:text-base text-white/70 leading-relaxed max-w-lg">
        {t("venueHero.subtitle")}
      </p>
    </div>
  );

  return (
    <ScrollChoreography
      images={images}
      overlay={overlay}
      className={className}
    />
  );
}
