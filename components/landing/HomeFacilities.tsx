"use client";

import FacilitiesCarousel from "./FacilitiesCarousel";

export default function HomeFacilities() {
  return (
    <section
      aria-labelledby="home-facilities-title"
      data-nav-theme="dark"
      className="overflow-x-clip bg-black px-0 py-24 md:py-32 pt-[calc(var(--nav-h,4rem)+3rem)] min-h-[100svh] flex flex-col justify-center"
    >
      <FacilitiesCarousel />
    </section>
  );
}
