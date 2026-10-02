"use client";

import { GripVertical } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface Reveal2Props {
  beforeImage: {
    src: string;
    alt: string;
  };
  afterImage: {
    src: string;
    alt: string;
  };
  showLabels?: boolean;
  initialPosition?: number;
  dividerWidth?: number;
  className?: string;
}

export function Reveal2({
  beforeImage,
  afterImage,
  showLabels = true,
  initialPosition = 50,
  dividerWidth = 2,
  className,
}: Reveal2Props) {
  const [position, setPosition] = useState(initialPosition);
  const [isDragging, setIsDragging] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMove = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setPosition(percentage);
    setHasInteracted(true);
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      setIsDragging(true);
      handleMove(e.clientX);
    },
    [handleMove]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (isDragging) {
        handleMove(e.clientX);
      }
    },
    [isDragging, handleMove]
  );

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    setIsDragging(false);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    let delta = 0;
    if (e.key === "ArrowLeft") delta = e.shiftKey ? -10 : -2;
    if (e.key === "ArrowRight") delta = e.shiftKey ? 10 : 2;
    if (e.key === "Home") {
      setPosition(0);
      setHasInteracted(true);
      e.preventDefault();
      return;
    }
    if (e.key === "End") {
      setPosition(100);
      setHasInteracted(true);
      e.preventDefault();
      return;
    }
    if (delta !== 0) {
      setPosition((prev) => Math.max(0, Math.min(100, prev + delta)));
      setHasInteracted(true);
      e.preventDefault();
    }
  }, []);

  const ariaValueText = `Space Infinity 顯示 ${Math.round(position)}%`;

  return (
    <div className={cn("relative w-full", className)}>
      <div
        ref={containerRef}
        role="slider"
        aria-label="拖動比較兩個包廂"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(position)}
        aria-valuetext={ariaValueText}
        tabIndex={0}
        className="relative overflow-hidden rounded-lg border border-white/15 aspect-[4/3] md:aspect-[16/10] select-none touch-pan-y cursor-ew-resize focus:outline-none focus:ring-2 focus:ring-white/50"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onKeyDown={handleKeyDown}
      >
        {/* After Image (Right - Space Eternity) */}
        <div className="absolute inset-0">
          <Image
            src={afterImage.src}
            alt={afterImage.alt}
            fill
            sizes="(max-width: 768px) 100vw, 58vw"
            className="object-cover object-center"
            loading="lazy"
          />
        </div>

        {/* Before Image (Left - Space Infinity) - clipped */}
        <div
          className="absolute inset-0"
          style={{
            clipPath: `inset(0 ${100 - position}% 0 0)`,
          }}
        >
          <Image
            src={beforeImage.src}
            alt={beforeImage.alt}
            fill
            sizes="(max-width: 768px) 100vw, 58vw"
            className="object-cover object-center"
            loading="lazy"
          />
        </div>

        {/* Divider Line */}
        <div
          className="absolute top-0 bottom-0 bg-white z-10 transform -translate-x-1/2 pointer-events-none"
          style={{
            left: `${position}%`,
            width: `${dividerWidth}px`,
          }}
        >
          {/* Handle - positioned at 85% height */}
          <div
            className={cn(
              "absolute bg-white rounded-full border-2 border-white",
              "flex items-center justify-center pointer-events-auto cursor-ew-resize",
              "w-11 h-11 left-1/2 -translate-x-1/2 transition-transform",
              isDragging && "scale-110"
            )}
            style={{ top: "85%" }}
          >
            <GripVertical className="w-5 h-5 text-black" />
          </div>
        </div>
      </div>

      {/* Hint text */}
      {!hasInteracted && (
        <p
          className="text-center text-white/50 text-sm mt-3 transition-opacity duration-500"
          style={{ opacity: hasInteracted ? 0 : 1 }}
        >
          左右拖動，比較兩個包廂
        </p>
      )}
    </div>
  );
}

export default Reveal2;
