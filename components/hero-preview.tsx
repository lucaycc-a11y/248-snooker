'use client';

import Image from 'next/image';

export default function HeroPreview() {
  return (
    <div className="hero-section relative w-screen h-screen overflow-hidden">
      {/* Table 1: Space Infinity - VISIBLE */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/images/space-infinity-room-中八桌球-香港新蒲崗.webp"
          alt="Space Infinity Room"
          fill
          className="object-cover"
          priority
        />
      </div>

      {/* Table 2: Space Eternity - HIDDEN */}
      <div className="absolute inset-0 z-0 opacity-0">
        <Image
          src="/images/space-eternity-room-中八桌球-香港新蒲崗.webp"
          alt="Space Eternity Room"
          fill
          className="object-cover"
          priority
        />
      </div>
    </div>
  );
}
