"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { QrCode, Cigarette } from "lucide-react";

export default function VenueHeroBento() {
  const t = useTranslations("venueBento");

  return (
    <section className="mx-auto max-w-[1120px] px-[14px] pt-20 pb-16 md:px-7 md:pt-24 md:pb-20">
      {/* Header with proper clearance from nav logo */}
      <div className="mb-6 px-1 md:mb-8">
        <h1 className="text-[clamp(28px,7.4vw,48px)] font-bold leading-[1.18] tracking-[-0.01em] text-[#EEF1EE]">
          {t("title")}
        </h1>
      </div>

      {/* Bento Grid */}
      <div className="grid grid-cols-2 gap-[10px] md:grid-cols-4 md:auto-rows-[minmax(clamp(190px,18vw,220px),auto)] md:gap-[14px]">
        {/* Room - Large photo tile */}
        <div className="photo-tile col-span-2 aspect-[4/3.1] md:col-start-1 md:col-span-2 md:row-start-1 md:row-span-2 md:aspect-auto">
          <Image
            src="/images/sofa-lounge-中八桌球-香港新蒲崗.webp"
            alt={t("room.alt")}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 50vw"
            priority
          />
          <div className="txt">
            <p className="cat">{t("room.category")}</p>
            <h2 className="ttl text-[clamp(20px,5.6vw,26px)] md:text-[28px]">休息區</h2>
          </div>
        </div>

        {/* Balls - Tall photo tile */}
        <div className="photo-tile row-span-2 md:col-start-3 md:row-start-1 md:row-span-2">
          <Image
            src="/images/aramith-balls-box-中八桌球-香港新蒲崗.webp"
            alt={t("balls.alt")}
            fill
            className="object-cover"
            style={{ objectPosition: "50% 58%" }}
            sizes="(max-width: 768px) 50vw, 25vw"
          />
          <div className="txt">
            <p className="cat">{t("balls.category")}</p>
            <h2 className="ttl">{t("balls.title")}</h2>
          </div>
        </div>

        {/* Scan - Icon tile */}
        <div className="icon-tile min-h-[clamp(170px,42vw,220px)] justify-between md:col-start-4 md:row-start-1 md:min-h-0">
          <div className="icon">
            <QrCode className="h-[56%] w-[56%]" strokeWidth={1.5} />
          </div>
          <div className="txt">
            <p className="cat">{t("scan.category")}</p>
            <h2 className="ttl text-[15px] md:text-[17px]">{t("scan.title")}</h2>
          </div>
        </div>

        {/* Smoke - Icon tile */}
        <div className="icon-tile min-h-[clamp(170px,42vw,220px)] justify-between md:col-start-4 md:row-start-2 md:min-h-0">
          <div className="icon">
            <Cigarette className="h-[56%] w-[56%]" strokeWidth={1.5} />
          </div>
          <div className="txt">
            <p className="cat">{t("smoke.category")}</p>
            <h2 className="ttl text-[15px] md:text-[17px]">{t("smoke.title")}</h2>
          </div>
        </div>

        {/* Score - Wide photo tile with dark background */}
        <div className="photo-tile col-span-2 aspect-[16/10] max-h-[420px] bg-[#0A0A0D] md:col-start-1 md:col-span-2 md:row-start-3 md:aspect-auto">
          <Image
            src="/gallery/spacepliot.png"
            alt={t("score.alt")}
            fill
            className="object-contain p-[6px_6px_58px] md:p-[16px_16px_16px_50%]"
            style={{ objectPosition: "right center" }}
            sizes="(max-width: 768px) 100vw, 50vw"
          />
          <div className="txt max-w-full md:max-w-[46%]">
            <p className="cat">{t("score.category")}</p>
            <h2 className="ttl">{t("score.title")}</h2>
          </div>
        </div>

        {/* Sofa - Wide icon tile with gradient */}
        <div className="sofa-tile col-span-2 min-h-0 flex-row items-center justify-start gap-4 md:col-start-3 md:col-span-2 md:row-start-3 md:flex-col md:items-start md:justify-end md:gap-0">
          <div className="icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M3 10v5a2 2 0 002 2h14a2 2 0 002-2v-5M3 10V9a2 2 0 012-2h14a2 2 0 012 2v1M3 10h18M7 19v-2m10 2v-2" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="txt mt-0 md:mt-[14px]">
            <p className="cat">{t("sofa.category")}</p>
            <h2 className="ttl">{t("sofa.title")}</h2>
          </div>
        </div>
      </div>

      <style jsx>{`
        .photo-tile {
          position: relative;
          overflow: hidden;
          border-radius: 22px;
          background: #101311;
          border: 1px solid rgba(255, 255, 255, 0.08);
          min-height: 150px;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          padding: 16px;
        }

        .photo-tile::after {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: linear-gradient(180deg, rgba(0, 0, 0, 0) 40%, rgba(0, 0, 0, 0.78) 100%);
        }

        .icon-tile {
          position: relative;
          overflow: hidden;
          border-radius: 22px;
          background: linear-gradient(160deg, #141816, #101311);
          border: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          flex-direction: column;
          padding: 16px;
        }

        .sofa-tile {
          position: relative;
          overflow: hidden;
          border-radius: 22px;
          background: linear-gradient(120deg, #0E2A1B 0%, #101311 70%);
          border: 1px solid rgba(34, 197, 94, 0.18);
          display: flex;
          padding: 14px 16px;
        }

        @media (min-width: 768px) {
          .photo-tile,
          .icon-tile {
            padding: 22px;
          }
          .sofa-tile {
            padding: 22px;
          }
        }

        .icon {
          width: clamp(66px, 17vw, 82px);
          height: clamp(66px, 17vw, 82px);
          border-radius: 20px;
          flex: 0 0 auto;
          display: grid;
          place-items: center;
          background: rgba(34, 197, 94, 0.12);
          border: 1px solid rgba(34, 197, 94, 0.26);
          color: #22C55E;
        }

        .sofa-tile .icon {
          margin: 0;
          width: 72px;
          height: 72px;
        }

        @media (min-width: 768px) {
          .sofa-tile .icon {
            margin-bottom: auto;
            width: clamp(66px, 17vw, 82px);
            height: clamp(66px, 17vw, 82px);
          }
        }

        .txt {
          position: relative;
          z-index: 1;
          margin-top: 14px;
        }

        .cat {
          font-size: 12px;
          font-weight: 600;
          color: #7BE3A5;
        }

        .photo-tile .cat {
          color: #7BE3A5;
        }

        .icon-tile .cat,
        .sofa-tile .cat {
          color: #22C55E;
        }

        .ttl {
          font-size: 17px;
          font-weight: 700;
          line-height: 1.35;
          margin-top: 4px;
          word-break: keep-all;
          overflow-wrap: anywhere;
          color: #EEF1EE;
        }

        @media (min-width: 768px) {
          .ttl {
            font-size: 19px;
          }
        }
      `}</style>
    </section>
  );
}
