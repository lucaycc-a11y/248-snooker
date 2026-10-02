"use client";

import { useEffect, useRef, useState, useCallback, createContext, useContext } from "react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import styles from "./FacilitiesCarousel.module.css";

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

const AUTOPLAY_INTERVAL = 5000;

type Facility = {
  title: string;
  body: string;
};

type CarouselContextType = {
  activeIndex: number;
  handlePrev: () => void;
  handleNext: () => void;
  scrollToCard: (index: number) => void;
  setActiveIndex: (index: number) => void;
};

const CarouselContext = createContext<CarouselContextType | null>(null);

function useCarouselContext() {
  const ctx = useContext(CarouselContext);
  if (!ctx) throw new Error("Carousel components must be used within CarouselContext");
  return ctx;
}

function CarouselArrows() {
  const { handlePrev, handleNext } = useCarouselContext();

  return (
    <div className={styles.arrows}>
      <button
        type="button"
        className={styles.arr}
        onClick={handlePrev}
        aria-label="上一項"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M15 18l-6-6 6-6"/>
        </svg>
      </button>
      <button
        type="button"
        className={styles.arr}
        onClick={handleNext}
        aria-label="下一項"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 6l6 6-6 6"/>
        </svg>
      </button>
    </div>
  );
}

function FacilitiesCarouselInner({ trackRef }: { trackRef: React.RefObject<HTMLDivElement> }) {
  const t = useTranslations("homeVenue");
  const facilities = t.raw("items") as Facility[];
  const visibleFacilities = facilities.slice(0, 4);

  const { activeIndex, scrollToCard, setActiveIndex } = useCarouselContext();
  const [isPaused, setIsPaused] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isTouching, setIsTouching] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState<{
    category: string;
    title: string;
    body: string;
    image: string;
    isSpacePilot: boolean;
  } | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastFocusRef = useRef<HTMLElement | null>(null);

  const n = visibleFacilities.length;
  const ctx = useCarouselContext();

  // Check if reduced motion is preferred
  const prefersReducedMotion = useRef(false);
  useEffect(() => {
    prefersReducedMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  // Update active index based on scroll position
  const handleScroll = useCallback(() => {
    if (!trackRef.current) return;
    const track = trackRef.current;
    const scrollLeft = track.scrollLeft;
    const cardWidth = track.children[0]?.getBoundingClientRect().width || 0;
    const gap = 16;
    const newIndex = Math.round(scrollLeft / (cardWidth + gap));
    setActiveIndex(Math.min(Math.max(0, newIndex), n - 1));
  }, [n, setActiveIndex, trackRef]);

  // Dot navigation
  const handleDotClick = useCallback((index: number) => {
    setActiveIndex(index);
    scrollToCard(index);
  }, [scrollToCard, setActiveIndex]);

  // Pause/play toggle
  const togglePause = useCallback(() => {
    setIsPaused(prev => !prev);
  }, []);

  // Open modal
  const openModal = useCallback((index: number) => {
    const facility = visibleFacilities[index];
    if (!facility) return;

    lastFocusRef.current = document.activeElement as HTMLElement;
    setModalContent({
      category: t(FACILITY_CATEGORIES[index]),
      title: facility.title,
      body: facility.body,
      image: FACILITY_IMAGES[index],
      isSpacePilot: index === 2,
    });
    setIsModalOpen(true);

    requestAnimationFrame(() => {
      dialogRef.current?.showModal();
      document.documentElement.style.overflow = 'hidden';
    });
  }, [visibleFacilities, t]);

  // Close modal
  const closeModal = useCallback(() => {
    dialogRef.current?.close();
    setIsModalOpen(false);
    document.documentElement.style.overflow = '';
    lastFocusRef.current?.focus();
    lastFocusRef.current = null;
  }, []);

  // Autoplay logic
  useEffect(() => {
    if (prefersReducedMotion.current) return;
    if (isPaused || isHovered || isTouching || isModalOpen) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      return;
    }

    // Check if tab is visible
    if (document.hidden) return;

    const ctx = useCarouselContext();
    timeoutRef.current = setTimeout(() => {
      ctx.handleNext();
    }, AUTOPLAY_INTERVAL);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isPaused, isHovered, isTouching, isModalOpen]);

  // Pause on visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  // Intersection observer for off-screen pause
  useEffect(() => {
    if (!trackRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (!entry.isIntersecting && timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }
        });
      },
      { threshold: 0.1 }
    );
    observer.observe(trackRef.current);
    return () => observer.disconnect();
  }, []);

  // Dialog ESC and backdrop click handlers
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleCancel = (e: Event) => {
      e.preventDefault();
      closeModal();
    };

    const handleClick = (e: MouseEvent) => {
      const rect = dialog.getBoundingClientRect();
      const isInDialog = (
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom
      );
      if (!isInDialog) {
        closeModal();
      }
    };

    dialog.addEventListener("cancel", handleCancel);
    dialog.addEventListener("click", handleClick);

    return () => {
      dialog.removeEventListener("cancel", handleCancel);
      dialog.removeEventListener("click", handleClick);
    };
  }, [closeModal]);

  return (
    <>
      <div className={styles.track}
        ref={trackRef}
        onScroll={handleScroll}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onTouchStart={() => setIsTouching(true)}
        onTouchEnd={() => setTimeout(() => setIsTouching(false), 300)}
      >
        {visibleFacilities.map((facility, index) => {
          const isSpacePilot = index === 2;
          return (
            <button
              key={index}
              type="button"
              className={`${styles.card} ${isSpacePilot ? styles.contain : ""}`}
              onClick={() => openModal(index)}
              aria-haspopup="dialog"
            >
              <Image
                src={FACILITY_IMAGES[index]}
                alt={facility.title}
                fill
                sizes="(max-width: 700px) 78vw, 27vw"
                priority={index === 0}
                className={styles.cardImage}
                style={{
                  objectFit: isSpacePilot ? "contain" : "cover",
                }}
              />
              <span className={styles.cap}>
                <span className={styles.cat}>{t(FACILITY_CATEGORIES[index])}</span>
                <span className={styles.ttl}>{facility.title}</span>
              </span>
              <span className={styles.plus} aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                  <path d="M12 5v14M5 12h14"/>
                </svg>
              </span>
            </button>
          );
        })}
      </div>

      <div className={`${styles.pill} ${isHovered || isTouching ? styles.hold : ""}`} role="group" aria-label={t("pagination_label")}>
        <div className={styles.dots}>
          {visibleFacilities.map((_, index) => (
            <button
              key={index}
              type="button"
              className={`${styles.dot} ${activeIndex === index ? styles.on : ""} ${activeIndex === index && !isPaused && !isHovered && !isTouching && !isModalOpen && !prefersReducedMotion.current ? styles.run : ""}`}
              onClick={() => handleDotClick(index)}
              aria-label={t("pagination_item", { n: index + 1 })}
            >
              <i style={{ "--dur": `${AUTOPLAY_INTERVAL}ms` } as React.CSSProperties}></i>
            </button>
          ))}
        </div>
        <button
          type="button"
          className={styles.pp}
          onClick={togglePause}
          aria-label={isPaused ? "開始自動播放" : "暫停自動播放"}
        >
          {isPaused ? (
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M8 5v14l11-7z"/>
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <rect x="6.5" y="5" width="3.6" height="14" rx="1.2"/>
              <rect x="13.9" y="5" width="3.6" height="14" rx="1.2"/>
            </svg>
          )}
        </button>
      </div>

      <dialog ref={dialogRef} className={styles.dlg} aria-labelledby="facilityDialogTitle">
        <button
          type="button"
          className={styles.dx}
          onClick={closeModal}
          aria-label={t("close")}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18"/>
          </svg>
        </button>
        {modalContent && (
          <div className={styles.din}>
            <div className={`${styles.dph} ${modalContent.isSpacePilot ? styles.contain : ""}`}>
              <Image
                src={modalContent.image}
                alt={modalContent.title}
                fill
                sizes="(max-width: 900px) 100vw, 50vw"
                style={{
                  objectFit: modalContent.isSpacePilot ? "contain" : "cover",
                }}
              />
            </div>
            <div className={styles.dbd}>
              <div className={styles.dcat}>{modalContent.category}</div>
              <h3 className={styles.dttl} id="facilityDialogTitle">{modalContent.title}</h3>
              <p className={styles.dtxt}>{modalContent.body}</p>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}

export function FacilitiesCarousel() {
  const t = useTranslations("homeVenue");
  const facilities = t.raw("items") as Facility[];
  const visibleFacilities = facilities.slice(0, 4);
  const n = visibleFacilities.length;

  const trackRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const prefersReducedMotion = useRef(false);
  useEffect(() => {
    prefersReducedMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const scrollToCard = useCallback((index: number) => {
    if (!trackRef.current) return;
    const cards = trackRef.current.children;
    if (cards[index]) {
      (cards[index] as HTMLElement).scrollIntoView({
        behavior: prefersReducedMotion.current ? "auto" : "smooth",
        block: "nearest",
        inline: "start",
      });
    }
  }, []);

  const handlePrev = useCallback(() => {
    const newIndex = activeIndex > 0 ? activeIndex - 1 : n - 1;
    setActiveIndex(newIndex);
    scrollToCard(newIndex);
  }, [activeIndex, n, scrollToCard]);

  const handleNext = useCallback(() => {
    const newIndex = activeIndex < n - 1 ? activeIndex + 1 : 0;
    setActiveIndex(newIndex);
    scrollToCard(newIndex);
  }, [activeIndex, n, scrollToCard]);

  return (
    <CarouselContext.Provider value={{ activeIndex, handlePrev, handleNext, scrollToCard, setActiveIndex }}>
      <FacilitiesCarouselInner trackRef={trackRef} />
    </CarouselContext.Provider>
  );
}

FacilitiesCarousel.Arrows = CarouselArrows;
