"use client";

import { useTranslations } from "next-intl";
import { AppleCardsCarousel } from "@/components/ui/apple-cards-carousel";
import { Link } from "@/i18n/navigation";

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

export default function HomeFacilitiesNew() {
  const t = useTranslations("homeVenue");
  const facilities = t.raw("items") as Facility[];
  const visibleFacilities = facilities.slice(0, 4);

  const items = visibleFacilities.map((facility, index) => {
    const isSpacePilot = index === 2;

    return {
      id: `facility-${index}`,
      image: FACILITY_IMAGES[index],
      alt: facility.title,
      category: t(FACILITY_CATEGORIES[index]),
      title: facility.title,
      caption: isSpacePilot ? (
        <>
          {facility.title}
          <span
            style={{
              display: "inline-block",
              marginLeft: "8px",
              padding: "4px 12px",
              fontSize: "11px",
              fontWeight: 600,
              color: "rgba(255,255,255,0.78)",
              border: "1px solid rgba(255,255,255,0.25)",
              borderRadius: "999px",
              verticalAlign: "middle",
              letterSpacing: "0.02em",
            }}
          >
            敬請期待
          </span>
        </>
      ) : (
        facility.title
      ),
      detail: facility.body,
      ...(isSpacePilot && {
        media: {
          fit: "contain" as const,
          padding: "48px 36px",
          background: "radial-gradient(ellipse 60% 50% at center, rgba(88, 28, 135, 0.32) 0%, rgba(37, 99, 235, 0.18) 40%, rgba(0, 0, 0, 0.95) 80%)",
        },
      }),
    };
  });

  return (
    <div className="relative">
      <AppleCardsCarousel
        heading={t("intro")}
        items={items}
        theme="dark"
        className="pb-16"
      />

      <div className="flex justify-center pb-24">
        <Link
          href="/venue"
          className="inline-flex items-center gap-2 px-6 py-3 min-h-[44px] font-medium text-[15px] text-white/90 border border-white/20 rounded-full hover:bg-white/5 hover:border-white/30 transition-all duration-200"
        >
          {t("learn_more")}
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 12l4-4-4-4" />
          </svg>
        </Link>
      </div>
    </div>
  );
}
