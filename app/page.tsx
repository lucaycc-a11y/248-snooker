"use client";

import Nav from "@/components/layout/Nav";
import Hero from "@/components/landing/Hero";
import Gallery from "@/components/landing/Gallery";
import HowItWorks from "@/components/landing/HowItWorks";
import Pricing from "@/components/landing/Pricing";
import Member from "@/components/landing/Member";

export default function Home() {
  return (
    <main className="relative bg-black">
      <Nav />
      <Hero />
      <Gallery />
      <HowItWorks />
      <Pricing />

      {/* Learn More scroll target — zero-height anchor, sections flow directly */}
      <div id="social-proof" aria-hidden="true" />

      {/* Membership — last section before footer */}
      <Member />
    </main>
  );
}
