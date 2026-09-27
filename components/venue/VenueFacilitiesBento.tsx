"use client";

import { useTranslations } from "next-intl";
import Image from "next/image";

export default function VenueFacilitiesBento() {
  const t = useTranslations("venuePage");

  return (
    <section className="venue-facilities-bento" data-nav-theme="dark">
      <style jsx>{`
        /* Bento facilities section - matches reference HTML exactly */
        .venue-facilities-bento {
          background: #060706;
          padding: 110px 28px 130px;
        }
        .vf-inner {
          max-width: 1120px;
          margin: 0 auto;
        }
        .vf-head {
          padding: 0 0 30px;
        }
        .vf-h1 {
          font-size: clamp(28px, 7.4vw, 48px);
          font-weight: 700;
          line-height: 1.18;
          letter-spacing: -0.01em;
          color: #EEF1EE;
          margin: 0;
        }
        .vf-bento {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        .vf-tile {
          position: relative;
          overflow: hidden;
          border-radius: 22px;
          background: #101311;
          border: 1px solid rgba(255,255,255,.08);
          min-height: 150px;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          padding: 16px;
        }
        .vf-tile :global(img) {
          object-fit: cover;
        }
        .vf-tile.photo::after {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,.78) 100%);
        }
        .vf-txt {
          position: relative;
          z-index: 1;
          margin-top: 14px;
        }
        .vf-cat {
          font-size: 12px;
          font-weight: 600;
          color: #22C55E;
        }
        .photo .vf-cat {
          color: #7BE3A5;
        }
        .vf-ttl {
          font-size: 17px;
          font-weight: 700;
          line-height: 1.35;
          margin-top: 4px;
          word-break: keep-all;
          overflow-wrap: anywhere;
          color: #EEF1EE;
        }

        /* Layout slots (mobile) */
        .vf-sofa {
          grid-column: 1/-1;
          aspect-ratio: 4/3.1;
        }
        .vf-balls {
          grid-row: span 2;
          min-height: 0;
        }
        .vf-chalk {
          min-height: clamp(170px, 42vw, 220px);
        }

        .vf-sofa .vf-ttl {
          font-size: clamp(20px, 5.6vw, 26px);
        }
        .vf-balls :global(img) {
          object-position: 50% 58%;
        }

        /* Tablet / desktop: 4-column bento */
        @media (min-width: 760px) {
          .venue-facilities-bento {
            padding: 110px 28px 130px;
          }
          .vf-head {
            padding: 56px 0 30px;
          }
          .vf-bento {
            grid-template-columns: repeat(4, 1fr);
            grid-auto-rows: minmax(clamp(190px, 18vw, 220px), auto);
            gap: 14px;
          }
          .vf-tile {
            padding: 22px;
            min-height: 0;
            aspect-ratio: auto;
          }
          .vf-sofa {
            grid-column: 1/3;
            grid-row: 1/3;
          }
          .vf-balls {
            grid-column: 3;
            grid-row: 1/3;
          }
          .vf-chalk {
            grid-column: 4;
            grid-row: 1/3;
            min-height: 0;
          }
          .vf-sofa .vf-ttl {
            font-size: 28px;
          }
          .vf-ttl {
            font-size: 19px;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          * {
            transition: none !important;
          }
        }
      `}</style>

      <div className="vf-inner">
        <header className="vf-head">
          <h2 className="vf-h1">{t("facilities_bento_title")}</h2>
        </header>
        <div className="vf-bento">
          {/* Sofa tile */}
          <div className="vf-tile vf-sofa photo">
            <Image
              src="/images/sofa-and-cue-stand-中八桌球-香港新蒲崗.webp"
              alt={t("facilities_bento_sofa_alt")}
              fill
              sizes="(max-width: 760px) 100vw, 50vw"
              quality={90}
              priority
            />
            <div className="vf-txt">
              <div className="vf-cat">{t("facilities_bento_sofa_cat")}</div>
              <h3 className="vf-ttl">{t("facilities_bento_sofa_title")}</h3>
            </div>
          </div>

          {/* Aramith balls tile */}
          <div className="vf-tile vf-balls photo">
            <Image
              src="/images/aramith-balls-box-中八桌球-香港新蒲崗.webp"
              alt={t("facilities_bento_balls_alt")}
              fill
              sizes="(max-width: 760px) 50vw, 25vw"
              quality={90}
            />
            <div className="vf-txt">
              <div className="vf-cat">{t("facilities_bento_balls_cat")}</div>
              <h3 className="vf-ttl">{t("facilities_bento_balls_title")}</h3>
            </div>
          </div>

          {/* Triangle chalk tile */}
          <div className="vf-tile vf-chalk photo">
            <Image
              src="/images/triangle-chalk-box-中八桌球-香港新蒲崗.webp"
              alt={t("facilities_bento_chalk_alt")}
              fill
              sizes="(max-width: 760px) 50vw, 25vw"
              quality={90}
            />
            <div className="vf-txt">
              <div className="vf-cat">{t("facilities_bento_chalk_cat")}</div>
              <h3 className="vf-ttl">{t("facilities_bento_chalk_title")}</h3>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
