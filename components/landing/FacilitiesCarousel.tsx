"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import styles from "./FacilitiesCarousel.module.css";
import Image from "next/image";

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

export default function FacilitiesCarousel() {
  const t = useTranslations("homeVenue");
  const tSpacePilot = useTranslations("spacePilot");
  const facilities = t.raw("items") as Facility[];
  const visibleFacilities = facilities.slice(0, 4);

  const trackRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [modalIndex, setModalIndex] = useState<number | null>(null);

  const syncScroll = () => {
    if (!trackRef.current) return;
    const track = trackRef.current;
    const max = track.scrollWidth - track.clientWidth;
    setCanScrollLeft(track.scrollLeft > 4);
    setCanScrollRight(track.scrollLeft < max - 4);
    const idx = max <= 0 ? 0 : Math.round((track.scrollLeft / max) * (visibleFacilities.length - 1));
    setActiveIndex(idx);
  };

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const handleScroll = () => requestAnimationFrame(syncScroll);
    track.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", syncScroll);
    syncScroll();
    return () => {
      track.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", syncScroll);
    };
  }, [visibleFacilities.length]);

  const getStepWidth = () => {
    if (!trackRef.current) return 300;
    const card = trackRef.current.querySelector(`.${styles.card}`) as HTMLElement;
    return card ? card.getBoundingClientRect().width + 20 : 300;
  };

  const scrollPrev = () => {
    trackRef.current?.scrollBy({ left: -getStepWidth(), behavior: "smooth" });
  };

  const scrollNext = () => {
    trackRef.current?.scrollBy({ left: getStepWidth(), behavior: "smooth" });
  };

  const openModal = (index: number) => {
    setModalIndex(index);
  };

  const closeModal = () => {
    setModalIndex(null);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (modalIndex !== null) {
        if (e.key === "Escape") closeModal();
        return;
      }
      if (e.key === "ArrowRight") scrollNext();
      if (e.key === "ArrowLeft") scrollPrev();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [modalIndex]);

  return (
    <>
      <div className={styles.head}>
        <div className={styles.txt}>
          <h2 className={styles.h1}>{t("intro")}</h2>
        </div>
        <div className={styles.arrows}>
          <button
            className={styles.arr}
            onClick={scrollPrev}
            disabled={!canScrollLeft}
            aria-label="Previous"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <button
            className={styles.arr}
            onClick={scrollNext}
            disabled={!canScrollRight}
            aria-label="Next"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>
        </div>
      </div>

      <div className={styles.track} ref={trackRef}>
        {visibleFacilities.map((facility, index) => {
          const isSpacePilot = index === 2;
          return (
            <article
              key={index}
              className={`${styles.card}${isSpacePilot ? ` ${styles.contain}` : ""}`}
            >
              <Image
                src={FACILITY_IMAGES[index]}
                alt={facility.title}
                fill
                className={styles.cardImage}
                sizes="(max-width: 768px) 78vw, 372px"
              />
              <div className={styles.cap}>
                <div className={styles.cat}>{t(FACILITY_CATEGORIES[index])}</div>
                <h3 className={styles.ttl}>{facility.title}</h3>
              </div>
              <button
                className={styles.plus}
                onClick={() => openModal(index)}
                aria-label="View details"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </button>
            </article>
          );
        })}
      </div>

      <div className={styles.dots}>
        {visibleFacilities.map((_, index) => (
          <i key={index} className={index === activeIndex ? styles.on : ""} />
        ))}
      </div>

      {modalIndex !== null && (
        <div className={styles.dlg} onClick={closeModal}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={`${styles.dph}${modalIndex === 2 ? ` ${styles.contain}` : ""}`}>
              <Image
                src={FACILITY_IMAGES[modalIndex]}
                alt={visibleFacilities[modalIndex].title}
                fill
                sizes="760px"
              />
            </div>
            <div className={styles.dbd}>
              <button className={styles.dx} onClick={closeModal} aria-label="Close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
              <div className={styles.dcat}>{t(FACILITY_CATEGORIES[modalIndex])}</div>
              <h3 className={styles.dttl}>{visibleFacilities[modalIndex].title}</h3>
              <p className={styles.dtxt}>
                {modalIndex === 2
                  ? "Space Pilot 智能小管家：掃碼報到、AI 推薦最公平的賽制、大螢幕即時比分，每一場勝負記入戰績，方便之後查看。"
                  : visibleFacilities[modalIndex].body}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
