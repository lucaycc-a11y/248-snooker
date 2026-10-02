"use client";

import { useTranslations } from "next-intl";
import { ScrollChoreography } from "./ScrollChoreography";

export function ScrollChoreographyWrapper() {
  const t = useTranslations("venueHero");

  const images = {
    topLeft: {
      src: "/images/space-eternity-room-中八桌球-香港新蒲崗.webp",
      alt: t("altSpaceEternity"),
      objectPosition: "center",
    },
    topRight: {
      src: "/images/space-infinity-room-中八桌球-香港新蒲崗.webp",
      alt: t("altSpaceInfinity"),
      objectPosition: "center",
    },
    bottomLeft: {
      src: "/images/space8-about-photos/images/about-06-lounge.webp",
      alt: t("altLounge"),
      objectPosition: "center",
    },
    bottomRight: {
      src: "/images/space8-about-photos/images/about-04-cove-lighting.webp",
      alt: t("altLighting"),
      objectPosition: "center",
    },
  };

  return (
    <ScrollChoreography
      images={images}
      overlay={
        <div className="flex flex-col gap-3">
          <div className="text-xs font-semibold text-white/70 uppercase tracking-widest">
            {t("eyebrow")}
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-light leading-tight">
            {t("title")}
          </h1>
          <p className="text-sm sm:text-base text-white/80 max-w-xl leading-relaxed">
            {t("subtitle")}
          </p>
        </div>
      }
    />
  );
}

export default ScrollChoreographyWrapper;
