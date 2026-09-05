"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useOutsideClick } from "@/hooks/use-outside-click";

type CarouselItem = {
  src: string;
  title: string;
  category: string;
  content: ReactNode;
};

type CarouselProps = {
  items: CarouselItem[];
};

export function BlurImage({ src, alt }: { src: string; alt: string }) {
  return <Image src={src} alt={alt} fill sizes="(max-width: 767px) 82vw, 320px" className="object-cover" />;
}

export function Card({ item, index, onOpen }: { item: CarouselItem; index: number; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${item.title} — ${item.category}`}
      className="group relative h-[440px] w-[82vw] max-w-[320px] shrink-0 snap-start overflow-hidden rounded-[24px] bg-[#1d1d1f] text-left md:h-[500px] md:w-[320px]"
    >
      <BlurImage src={item.src} alt={item.title} />
      <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
      <span className="absolute inset-x-6 bottom-6">
        <span data-cms-key={`homeVenue.items.${index}.category`} className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-white/65">
          {item.category}
        </span>
        <span data-cms-key={`homeVenue.items.${index}.title`} className="block font-code text-[22px] font-bold leading-[1.15] text-white">
          {item.title}
        </span>
      </span>
    </button>
  );
}

export function Carousel({ items }: CarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const activeItem = activeIndex === null ? null : items[activeIndex];

  const close = useCallback(() => setActiveIndex(null), []);
  useOutsideClick(modalRef, close);

  useEffect(() => {
    if (activeItem === null) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [activeItem]);

  const scroll = (direction: -1 | 1) => {
    trackRef.current?.scrollBy({ left: direction * 336, behavior: "smooth" });
  };

  return (
    <>
      <div className="relative">
        <div
          ref={trackRef}
          className="facilities-carousel-track flex snap-x snap-mandatory gap-4 overflow-x-auto px-6 pb-5 no-scrollbar md:px-16"
          style={{ touchAction: "pan-x pan-y", overscrollBehaviorX: "contain", overscrollBehaviorY: "auto" }}
        >
          {items.map((item, index) => (
            <Card key={`${item.title}-${index}`} item={item} index={index} onOpen={() => setActiveIndex(index)} />
          ))}
        </div>
        <div className="mt-5 hidden justify-end gap-2 px-16 md:flex">
          <button type="button" onClick={() => scroll(-1)} aria-label="Previous facility" className="grid h-11 w-11 place-items-center rounded-full border border-black/10 bg-white text-[#111110] transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-105">
            <ChevronLeft size={18} strokeWidth={1.6} />
          </button>
          <button type="button" onClick={() => scroll(1)} aria-label="Next facility" className="grid h-11 w-11 place-items-center rounded-full border border-black/10 bg-white text-[#111110] transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-105">
            <ChevronRight size={18} strokeWidth={1.6} />
          </button>
        </div>
      </div>

      {activeItem && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/60 p-5 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={activeItem.title}>
          <div ref={modalRef} className="relative max-h-[min(680px,calc(100dvh-40px))] w-full max-w-lg overflow-y-auto rounded-[24px] bg-[#1d1d1f] p-7 text-white">
            <button type="button" onClick={close} aria-label="Close facility details" className="absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-full text-white/65 transition-colors hover:text-white">
              <X size={20} strokeWidth={1.6} />
            </button>
            <p className="mb-3 pr-12 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55">{activeItem.category}</p>
            <h3 className="mb-5 pr-12 font-code text-[28px] font-bold leading-[1.15]">{activeItem.title}</h3>
            <div className="text-[16px] leading-[1.75] text-white/70">{activeItem.content}</div>
          </div>
        </div>
      )}
    </>
  );
}
