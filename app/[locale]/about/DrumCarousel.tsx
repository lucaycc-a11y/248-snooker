"use client";

// 3-photo carousel (點項) — scrolls horizontally below the hero.
// Shows only the 3 drum cards: 專業 (about-08), 科技 (about-04), 空間 (about-06).

import * as React from "react";
import { useRef, useEffect, useState } from "react";
import Image from "next/image";
import manifest from "@/public/images/space8-about-photos/manifest.json";

// Map point indices to manifest item indices: [專業, 科技, 空間] → [about-08, about-04, about-06]
const POINT_PHOTO_INDICES = [7, 3, 5] as const;

interface DrumCard {
  order: number;
  title: string;
  description: string;
  image: string;
  alt: string;
}

const DRUM_CARDS: DrumCard[] = POINT_PHOTO_INDICES.map((idx) => {
  const item = manifest.items[idx];
  return {
    order: item.order,
    title: item.title,
    description: item.description,
    image: `/images/space8-about-photos/${item.file.replace(/\.jpg$/, ".webp")}`,
    alt: item.alt,
  };
});

export function DrumCarousel() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  // Handle scroll snapping and active index tracking
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const scrollLeft = container.scrollLeft;
      const cardWidth = container.scrollWidth / DRUM_CARDS.length;
      const idx = Math.round(scrollLeft / cardWidth);
      setActiveIdx(Math.min(idx, DRUM_CARDS.length - 1));
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="w-full bg-white py-12">
      {/* Carousel container — horizontal scroll, snap to cards */}
      <div
        ref={containerRef}
        className="flex gap-6 px-6 overflow-x-auto scroll-smooth"
        style={{
          scrollBehavior: "smooth",
          scrollSnapType: "x mandatory",
        }}
      >
        {DRUM_CARDS.map((card, idx) => (
          <div
            key={idx}
            className="flex-shrink-0 w-full md:w-1/2 lg:w-1/3"
            style={{
              scrollSnapAlign: "center",
              scrollSnapStop: "always",
            }}
          >
            <div className="flex flex-col gap-4">
              {/* Image */}
              <div
                className="relative w-full overflow-hidden rounded-lg bg-gray-100"
                style={{ aspectRatio: "3 / 2" }}
              >
                <Image
                  src={card.image}
                  alt={card.alt}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                />
              </div>

              {/* Content */}
              <div className="px-2">
                <h3
                  className="text-lg font-semibold text-black mb-2"
                  style={{
                    fontFamily: "'Noto Sans TC', sans-serif",
                  }}
                >
                  {card.title}
                </h3>
                <p
                  className="text-sm text-gray-700 leading-relaxed"
                  style={{
                    fontFamily: "'Noto Sans TC', sans-serif",
                    whiteSpace: "pre-line",
                  }}
                >
                  {card.description}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Dot indicators */}
      <div className="flex justify-center gap-2 mt-8">
        {DRUM_CARDS.map((_, idx) => (
          <button
            key={idx}
            onClick={() => {
              if (containerRef.current) {
                const cardWidth = containerRef.current.scrollWidth / DRUM_CARDS.length;
                containerRef.current.scrollLeft = idx * cardWidth;
              }
            }}
            className="w-2 h-2 rounded-full transition-colors"
            style={{
              backgroundColor: activeIdx === idx ? "#22c55e" : "#e5e7eb",
            }}
            aria-label={`Go to slide ${idx + 1}`}
          />
        ))}
      </div>
    </div>
  );
}

export default DrumCarousel;
