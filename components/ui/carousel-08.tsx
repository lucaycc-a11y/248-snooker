"use client";

import * as React from "react";
import { ArrowUpRight, ArrowLeft, ArrowRight } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import { ReactNode } from "react";
import Image from "next/image";

interface CardItem {
  id: string;
  category?: string;
  title: ReactNode;
  titleFont?: string;
  src: string;
  alt?: string;
  desc?: string;
  aspectRatio?: string;
  objectFit?: "cover" | "contain";
}

interface AppleCardCarouselProps {
  cards: CardItem[];
  heading?: string;
}

const AppleCardCarousel = ({ cards, heading }: AppleCardCarouselProps) => {
  const [api, setApi] = React.useState<CarouselApi>();
  const [canScrollPrev, setCanScrollPrev] = React.useState(false);
  const [canScrollNext, setCanScrollNext] = React.useState(true);

  React.useEffect(() => {
    if (!api) return;
    const update = () => {
      setCanScrollPrev(api.canScrollPrev());
      setCanScrollNext(api.canScrollNext());
    };
    update();
    api.on("select", update);
    api.on("reInit", update);
    return () => {
      api.off("select", update);
      api.off("reInit", update);
    };
  }, [api]);

  return (
    <div className="w-full py-5 sm:py-10" style={{ background: '#000' }}>
      {/* Header */}
      {heading && (
        <div className="px-4 sm:px-8 mb-8 sm:mb-12">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-medium tracking-tight text-white">
            {heading}
          </h2>
        </div>
      )}

      {/* Card Strip */}
      <Carousel
        setApi={setApi}
        opts={{ align: "start", dragFree: true }}
        className="w-full"
      >
        <CarouselContent className="-ml-6 px-4 sm:px-8 py-4">
          {cards.map((card) => (
            <CarouselItem key={card.id} className="pl-6 basis-auto">
              <div
                className="group relative overflow-hidden flex flex-col justify-between p-6 sm:p-8 rounded-2xl hover:scale-102 transition-transform duration-300 cursor-pointer border border-white/10"
                style={{
                  width: 'min(72vw, 560px)',
                  aspectRatio: card.aspectRatio || '3 / 4',
                  background: '#0a0a0a'
                }}
              >
                <Image
                  src={card.src}
                  alt={card.alt || (typeof card.title === "string" ? card.title : card.category || "")}
                  fill
                  sizes="(max-width: 768px) 72vw, 560px"
                  className="absolute inset-0 w-full h-full object-cover"
                  style={{
                    objectFit: card.objectFit || 'cover',
                    objectPosition: 'center'
                  }}
                />

                <div className="relative z-10 flex flex-col gap-3 sm:gap-4 text-white">
                  {card.category && (
                    <p className="text-sm sm:text-base font-medium">
                      {card.category}
                    </p>
                  )}
                  <p
                    className="text-2xl sm:text-3xl font-medium tracking-tight leading-tight"
                    style={card.titleFont ? { fontFamily: card.titleFont } : undefined}
                  >
                    {card.title}
                  </p>
                </div>

                <div className="relative z-10 flex justify-end">
                  <button
                    className="h-10 w-10 rounded-full shadow-xs bg-white hover:bg-white/80 cursor-pointer flex items-center justify-center transition-colors"
                  >
                    <ArrowUpRight className="h-4 w-4 text-black transition-transform duration-300 group-hover:rotate-45 will-change-transform" />
                  </button>
                </div>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>

      {/* Bottom-right controls */}
      <div className="flex justify-end gap-2 px-4 sm:px-8 mt-6">
        <button
          onClick={() => api?.scrollPrev()}
          disabled={!canScrollPrev}
          className="h-10 w-10 rounded-full bg-white/10 border border-white/20 text-white hover:bg-white/20 shadow-xs flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <button
          onClick={() => api?.scrollNext()}
          disabled={!canScrollNext}
          className="h-10 w-10 rounded-full bg-white/10 border border-white/20 text-white hover:bg-white/20 shadow-xs flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default AppleCardCarousel;
