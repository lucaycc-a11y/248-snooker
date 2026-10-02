"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { Link } from "@/i18n/navigation";
import HomePricing from "@/components/landing/HomePricing";
import CinematicOrbitHero from "@/components/ui/cinematic-orbit-hero";
import Reveal2 from "@/components/ui/reveal2";
import AppleCardCarousel from "@/components/ui/carousel-08";
import {
  Target,
  Lightbulb,
  Thermometer,
  Wifi,
  CupSoda,
  QrCode,
  MapPin,
  CloudRain,
  Star,
  Sun,
  Moon,
  ChevronLeft,
} from "lucide-react";

const DARK = "#1D1D1F";
const SUBTLE = "#6e6e73";
const GOLD = "#1a9d5c";
const GOLD_BRIGHT = "#22b86b";

const FONT_FAMILY =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Helvetica, Arial, sans-serif";

const EASE = [0.16, 1, 0.3, 1] as const;
const VIEWPORT = { once: true, amount: 0.25 } as const;

// ADDRESS moved to i18n
const MAPS_URL = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
  "泰力工業中心 32 Tai Yau Street, San Po Kong, Hong Kong",
)}`;

const FACILITY_ICONS = [Target, Lightbulb, Thermometer, Wifi, CupSoda, QrCode];
const FACILITY_ICON_CLASSES = ['si-target', 'si-bulb', 'si-therm', 'si-wifi', 'si-cup', 'si-qr'];

type TitledItem = { title: string; body: string };

/* ── Injected CSS ── */
const SITE_CSS = `
/* ===== ROOM COMPARISON (03) ===== */
.room-comparison-section {
  background: #000000;
  padding: 120px 24px;
}
.room-comparison-inner {
  max-width: 1200px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1fr;
  gap: 64px;
}
.room-comparison-text {
  display: flex;
  flex-direction: column;
  gap: 32px;
}
.room-comparison-heading {
  font-size: clamp(2rem, 4.5vw, 3rem);
  font-weight: 700;
  color: #ffffff;
  margin: 0;
  line-height: 1.2;
}
.room-comparison-intro {
  font-size: clamp(1rem, 2vw, 1.125rem);
  color: rgba(255,255,255,0.55);
  margin: 0;
  line-height: 1.6;
  max-width: 48ch;
}
.room-comparison-features {
  display: flex;
  flex-direction: column;
  gap: 32px;
  margin-top: 48px;
}
.room-feature {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.room-feature-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: rgba(255,255,255,0.5);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.room-feature-value {
  font-size: clamp(1.25rem, 2.5vw, 1.5rem);
  font-weight: 600;
  color: #ffffff;
  line-height: 1.3;
}
.room-comparison-slider {
  width: 100%;
}

@media (min-width: 1024px) {
  .room-comparison-inner {
    grid-template-columns: 5fr 7fr;
    gap: 80px;
    align-items: center;
  }
}
@media (max-width: 640px) {
  .room-comparison-section { padding: 80px 24px; }
  .room-comparison-features { gap: 24px; margin-top: 32px; }
}

/* ===== BELOW HERO ===== */
.hero-after-section {
  background: #000000;
  padding: 60px 24px 80px;
}
.hero-after-inner { max-width: 680px; margin: 0 auto; }
.hero-after-title {
  font-family: 'Noto Sans TC', sans-serif;
  font-weight: 900;
  font-size: clamp(1.7rem, 3.4vw, 2.4rem);
  color: #f5f2ec;
  margin: 0 0 20px;
  line-height: 1.3;
}
.hero-after-body {
  font-size: clamp(14px, 1.4vw, 16px);
  line-height: 1.7;
  color: rgba(255,255,255,0.6);
  max-width: 65ch;
  margin: 0;
}
@media (max-width: 560px) {
  .hero-after-section { padding: 40px 24px 48px; }
}

/* ===== FACILITIES (Apple 3-col) ===== */
.facility-section {
  background: #000000;
  padding: 96px 24px 120px;
}
.facility-inner { max-width: 1160px; margin: 0 auto; }
.facility-title {
  font-family: 'Noto Sans TC', sans-serif;
  font-weight: 900;
  font-size: clamp(1.7rem, 3.4vw, 2.4rem);
  color: #f5f2ec;
  margin-bottom: 56px;
  letter-spacing: -0.02em;
}
.facility-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 28px;
}
.facility-card {
  border-radius: 20px;
  background: #1d1d1f;
  border: 1px solid rgba(255,255,255,0.12);
  padding: 40px 32px;
}
.facility-card:hover {
  border-color: rgba(255,255,255,0.18);
  background: #232325;
}
.facility-icon { width: 32px; height: 32px; color: #22b86b; margin-bottom: 24px; }
.facility-icon svg { width: 100%; height: 100%; display: block; stroke-width: 1.5; }
.facility-card h3 {
  font-family: 'Noto Sans TC', sans-serif;
  font-weight: 700;
  font-size: 18px;
  color: #f5f2ec;
  margin: 0 0 12px;
  letter-spacing: -0.01em;
}
.facility-card p {
  font-size: 15px;
  line-height: 1.6;
  color: rgba(255,255,255,0.64);
  margin: 0;
}
@media (max-width: 900px) { .facility-grid { grid-template-columns: repeat(2, 1fr); gap: 24px; } }
@media (max-width: 560px) {
  .facility-grid { grid-template-columns: 1fr; }
  .facility-section { padding: 80px 24px 96px; }
  .facility-title { margin-bottom: 40px; }
  .facility-card { padding: 32px 28px; }
}

/* ===== ROOM COMPARISON (WIPE SLIDER) ===== */
.compare-section {
  background: #000000;
  padding: 96px 24px 120px;
}
.compare-inner { max-width: 1160px; margin: 0 auto; }
.compare-title {
  font-family: 'Noto Sans TC', sans-serif;
  font-weight: 900;
  font-size: clamp(1.7rem, 3.4vw, 2.4rem);
  color: #f5f2ec;
  margin-bottom: 56px;
  letter-spacing: -0.02em;
}
.compare-frame {
  position: relative;
  width: 100%;
  max-width: 960px;
  aspect-ratio: 16 / 10;
  margin: 0 auto 48px;
  border-radius: 24px;
  overflow: hidden;
  background: #1d1d1f;
  cursor: col-resize;
}
.compare-clip-outer {
  position: absolute;
  inset: 0;
}
.compare-images {
  position: absolute;
  inset: 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
}
.compare-img-left,
.compare-img-right {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.compare-clip-inner {
  position: absolute;
  inset: 0;
  overflow: hidden;
}
.compare-handle {
  position: absolute;
  top: 0;
  width: 4px;
  height: 100%;
  background: #22b86b;
  transform: translateX(-50%);
  cursor: grab;
  display: flex;
  align-items: center;
  justify-content: center;
}
.compare-handle svg {
  width: 24px;
  height: 24px;
  color: white;
  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
}
.compare-labels {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 40px;
  max-width: 960px;
  margin: 0 auto;
}
.compare-label-left,
.compare-label-right {
  text-align: left;
}
.compare-label-right {
  text-align: right;
}
.compare-label-left p,
.compare-label-right p {
  font-weight: 700;
  font-size: clamp(16px, 2vw, 20px);
  color: white;
  margin: 0 0 8px;
}
.compare-label-left span,
.compare-label-right span {
  display: block;
  font-size: 14px;
  line-height: 1.6;
  color: rgba(255,255,255,0.54);
  margin: 0;
}
@media (max-width: 560px) {
  .compare-section { padding: 80px 24px 96px; }
  .compare-labels { gap: 24px; }
  .compare-label-left p,
  .compare-label-right p { font-size: 16px; }
}

  color: #fff;
  background: #1a9d5c;
  padding: 3px 9px;
  border-radius: 999px;
  white-space: nowrap;
}
.rate-meta p {
  font-family: system-ui, -apple-system, SF Pro Text, sans-serif;
  font-size: 13px;
  color: rgba(17,17,16,0.48);
  margin: 0;
}
.rate-deal {
  display: inline-block;
  margin-top: 8px;
  font-family: 'Noto Sans TC', sans-serif;
  font-size: 12px;
  color: #137a46;
  background: rgba(26,157,92,0.13);
  padding: 5px 11px;
  border-radius: 999px;
}
.rate-deal b { font-weight: 700; }
.rate-price { text-align: right; white-space: nowrap; }
.rate-price b {
  display: block;
  font-family: system-ui, -apple-system, SF Pro Text, sans-serif;
  font-weight: 600;
  font-size: clamp(1.5rem, 2.6vw, 1.95rem);
  letter-spacing: -0.02em;
  color: #111110;
  line-height: 1.1;
}
.rate-price span {
  font-family: 'Noto Sans TC', sans-serif;
  font-size: 12.5px;
  color: rgba(17,17,16,0.45);
}
@media (max-width: 900px) {
  .rate-layout { grid-template-columns: 1fr; gap: 36px; }
  .rate-sub { max-width: none; }
}
@media (max-width: 560px) {
  .rate-section { padding: 80px 20px 96px; }
  .rate-layout { gap: 32px; }
  .rate-sub { font-size: 14px; margin-bottom: 24px; }
  .rate-row { grid-template-columns: 1fr; gap: 0; padding: 24px; border-radius: 20px; border: 1px solid rgba(17,17,16,0.10); margin-bottom: 16px; }
  .rate-row + .rate-row { border-top: 1px solid rgba(17,17,16,0.10); }
  .rate-row.is-best { border-color: rgba(26,157,92,0.35); }
  .rate-row.is-best::before { width: 100%; height: 3px; top: 0; bottom: auto; }
  .rate-ic { margin-bottom: 12px; }
  .rate-meta { text-align: center; }
  .rate-meta h3 { justify-content: center; font-size: 17px; }
  .rate-price { grid-column: 1 / -1; text-align: center; padding-left: 0; margin-top: 12px; padding-top: 16px; border-top: 1px solid rgba(17,17,16,0.07); }
  .rate-price b { font-size: 1.65rem; }
  .rate-price span { font-size: 12px; }
  .rate-deal { display: inline-block; margin-top: 8px; }
  .rate-cta { width: 100%; justify-content: center; }
}
@media (prefers-reduced-motion: reduce) {
  .rate-row { opacity: 1; transform: none; transition: none; }
}

/* ===== NOTES ===== */
.notes-section {
  background: #1d1d1f;
  padding: 120px 24px 140px;
}
.notes-inner { max-width: 1000px; margin: 0 auto; }
.notes-title {
  font-family: 'Noto Sans TC', sans-serif;
  font-weight: 900;
  font-size: clamp(1.7rem, 3.4vw, 2.4rem);
  color: #f5f2ec;
  margin-bottom: 48px;
}
.notes-list { list-style: none; border-top: 1px solid rgba(245,242,236,0.10); margin: 0; padding: 0; }
.notes-list li {
  display: flex;
  align-items: flex-start;
  gap: 18px;
  padding: 22px 4px;
  border-bottom: 1px solid rgba(245,242,236,0.10);
}
.notes-num {
  flex-shrink: 0;
  width: 26px; height: 26px;
  border-radius: 50%;
  border: 1px solid rgba(37,211,102,0.3);
  color: #25D366;
  font-family: system-ui, -apple-system, SF Pro Text, sans-serif;
  font-size: 11.5px;
  font-weight: 600;
  display: flex; align-items: center; justify-content: center;
  margin-top: 1px;
}
.notes-list p {
  font-family: 'Noto Sans TC', sans-serif;
  font-size: 15px;
  line-height: 1.75;
  color: #f5f2ec;
  margin: 0;
}
.notes-link {
  display: inline-block;
  margin-top: 34px;
  font-family: 'Noto Sans TC', sans-serif;
  font-size: 14.5px;
  color: #22b86b;
  text-decoration: underline;
  text-underline-offset: 4px;
  text-decoration-thickness: 1px;
  transition: color .3s ease, text-decoration-color .3s ease;
}
.notes-link:hover { color: #4ad48c; }
@media (max-width: 560px) {
  .notes-section { padding: 80px 24px 96px; }
  .notes-title { margin-bottom: 32px; }
  .notes-list li { gap: 14px; padding: 16px 2px; }
  .notes-list p { font-size: 14px; }
}

/* ===== WEATHER ===== */
.weather-section {
  background: #000000;
  padding: 120px 24px 140px;
}
.weather-inner { max-width: 1000px; margin: 0 auto; }
.weather-card {
  position: relative;
  border-radius: 20px;
  background: #0b0b0d;
  border: 1px solid rgba(255,255,255,0.26);
  padding: 46px 44px 48px;
  overflow: hidden;
}
.weather-card::before {
  content: "";
  position: absolute; inset: 0;
  border-radius: inherit;
  padding: 1px;
  background: radial-gradient(300px circle at var(--mx,50%) var(--my,0%), rgba(34,184,107,0.95), transparent 62%);
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  opacity: 0;
  transition: opacity .4s ease;
  pointer-events: none;
}
.weather-card::after {
  content: "";
  position: absolute; inset: 0;
  border-radius: inherit;
  background: radial-gradient(420px circle at var(--mx,50%) var(--my,0%), rgba(34,184,107,0.09), transparent 68%);
  opacity: 0;
  transition: opacity .4s ease;
  pointer-events: none;
}
.weather-card:hover::before,
.weather-card:hover::after { opacity: 1; }
.weather-header {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 18px;
  margin-bottom: 32px;
}
.weather-icon { flex-shrink: 0; width: 52px; height: 52px; color: #22b86b; }
.weather-icon svg { width: 100%; height: 100%; display: block; overflow: visible; }
.weather-title {
  font-family: 'Noto Sans TC', sans-serif;
  font-weight: 900;
  font-size: clamp(1.4rem, 2.8vw, 1.95rem);
  color: #f5f2ec;
  line-height: 1.2;
  margin: 0;
}
.weather-body { position: relative; z-index: 1; }
.weather-block + .weather-block { margin-top: 34px; }
.weather-head {
  font-family: 'Noto Sans TC', sans-serif;
  font-weight: 700;
  font-size: 15.5px;
  color: #f5f2ec;
  margin: 0 0 14px;
}
.weather-list { list-style: none; margin: 0; padding: 0; }
.weather-list li {
  position: relative;
  padding-left: 20px;
  font-family: 'Noto Sans TC', sans-serif;
  font-size: 14.5px;
  line-height: 1.9;
  color: rgba(245,242,236,0.62);
}
.weather-list li + li { margin-top: 10px; }
.weather-list li::before {
  content: "";
  position: absolute;
  left: 2px;
  top: 0.82em;
  width: 5px; height: 5px;
  border-radius: 50%;
  background: #22b86b;
}
.weather-list li b { color: #f5f2ec; font-weight: 700; }
@media (max-width: 560px) {
  .weather-section { padding: 80px 24px 48px; }
  .weather-card { padding: 32px 24px 34px; border-radius: 16px; }
  .weather-header { gap: 13px; margin-bottom: 26px; }
  .weather-icon { width: 38px; height: 38px; }
  .weather-list li { font-size: 13.5px; padding-left: 17px; }
}

/* ===== DIRECTIONS ===== */
.dir-section {
  background: #ffffff;
  padding: 120px 24px 140px;
}
.dir-inner { max-width: 1100px; margin: 0 auto; }
.dir-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 28px;
}
.dir-title {
  font-family: 'Noto Sans TC', sans-serif;
  font-weight: 900;
  font-size: clamp(1.4rem, 2.8vw, 1.95rem);
  color: #111110;
  line-height: 1.2;
  margin: 0;
}
.dir-layout {
  display: grid;
  grid-template-columns: 1fr 0.85fr;
  gap: 34px;
  align-items: stretch;
}
.dir-card {
  background: #ffffff;
  border: 1px solid rgba(17,17,16,0.14);
  border-radius: 20px;
  padding: 42px 40px 44px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  box-shadow: 0 1px 2px rgba(17,17,16,0.04);
}
.dir-pin { flex-shrink: 0; width: 38px; height: 38px; color: #1a9d5c; }
.dir-pin svg { width: 100%; height: 100%; display: block; }
.dir-address {
  font-family: 'Noto Sans TC', sans-serif;
  font-weight: 700;
  font-size: clamp(16px, 1.9vw, 19px);
  line-height: 1.6;
  color: #111110;
  margin-bottom: 14px;
}
.dir-notes { list-style: none; margin: 0 0 30px; padding: 0; }
.dir-notes li {
  position: relative;
  padding-left: 17px;
  font-family: 'Noto Sans TC', sans-serif;
  font-size: 13.8px;
  line-height: 1.75;
  color: rgba(17,17,16,0.58);
}
.dir-notes li + li { margin-top: 8px; }
.dir-notes li::before {
  content: "";
  position: absolute;
  left: 1px;
  top: 0.72em;
  width: 5px; height: 5px;
  border-radius: 50%;
  background: #1a9d5c;
}
.dir-actions {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
}
.dir-btn {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  font-family: 'Noto Sans TC', sans-serif;
  font-size: 14.5px;
  font-weight: 500;
  padding: 14px 26px;
  border-radius: 999px;
  text-decoration: none;
  cursor: pointer;
  transition: transform .35s cubic-bezier(.2,.7,.3,1), box-shadow .35s ease, border-color .3s ease;
}
.dir-btn svg { width: 17px; height: 17px; flex-shrink: 0; }
.dir-btn.primary {
  background: linear-gradient(180deg, #22b86b, #1a9d5c);
  color: #ffffff;
  box-shadow: 0 8px 26px -10px rgba(26,157,92,0.55);
}
.dir-btn.primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 14px 34px -10px rgba(26,157,92,0.65);
}
.dir-btn.ghost {
  background: transparent;
  color: #111110;
  border: 1px solid rgba(17,17,16,0.22);
}
.dir-btn.ghost:hover { border-color: rgba(17,17,16,0.5); transform: translateY(-2px); }
.dir-map {
  position: relative;
  border: 1px solid rgba(17,17,16,0.14);
  border-radius: 20px;
  overflow: hidden;
  background: #eceae5;
  min-height: 380px;
}
.dir-map iframe {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: 0;
  display: block;
}
@media (max-width: 880px) {
  .dir-layout { grid-template-columns: 1fr; gap: 24px; }
  .dir-card { padding: 34px 28px 36px; }
  .dir-map { aspect-ratio: 4 / 3; min-height: 0; }
}
@media (max-width: 560px) {
  .dir-section { padding: 80px 24px 96px; }
  .dir-card { padding: 24px; border-radius: 20px; }
  .dir-header { gap: 12px; margin-bottom: 20px; }
  .dir-pin { width: 30px; height: 30px; }
  .dir-map { border-radius: 16px; }
  .dir-actions { gap: 10px; flex-direction: column; }
  .dir-btn { padding: 13px 20px; font-size: 13.5px; width: 100%; justify-content: center; min-height: 48px; }
  .venue-dir-cta-button { width: 100% !important; min-height: 48px !important; justify-content: center !important; }
  .dir-notes { margin-bottom: 24px; }
}
`;

export default function VenueContent() {
  const t = useTranslations("venuePage");
  const facilities = t.raw("facilities") as TitledItem[];
  const rules = t.raw("rules") as string[];

  const [isMobile, setIsMobile] = useState(false);
  const [periods, setPeriods] = useState<any[]>([]);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  /* ── Fetch pricing from config ── */
  useEffect(() => {
    const fetchPricing = async () => {
      try {
        const res = await fetch("/api/pricing");
        if (res.ok) {
          const data = await res.json();
          setPeriods(data.periods);
        }
      } catch (err) {
        console.error("Failed to fetch pricing:", err);
      }
    };
    fetchPricing();
  }, []);

  /* ── Comparison slider (matches reference HTML exactly) ── */
  const compareRef = useRef<HTMLDivElement>(null);
  const [sliderPos, setSliderPos] = useState(50);
  const draggingRef = useRef(false);

  const sizeClipImg = useCallback(() => {
    const frame = compareRef.current;
    const clipInner = frame?.querySelector(".compare-clip-inner") as HTMLElement | null;
    if (frame && clipInner) {
      clipInner.style.width = frame.clientWidth + "px";
    }
  }, []);

  useEffect(() => {
    const frame = compareRef.current;
    if (!frame) return;

    function setPos(pct: number) {
      pct = Math.max(0, Math.min(100, pct));
      setSliderPos(pct);
    }

    function posFromEvent(e: MouseEvent | TouchEvent) {
      const rect = frame!.getBoundingClientRect();
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      return ((clientX - rect.left) / rect.width) * 100;
    }

    function onDown(e: MouseEvent | TouchEvent) {
      draggingRef.current = true;
      setPos(posFromEvent(e));
    }
    function onMove(e: MouseEvent | TouchEvent) {
      if (!draggingRef.current) return;
      if (e.cancelable) e.preventDefault();
      setPos(posFromEvent(e));
    }
    function onUp() {
      draggingRef.current = false;
    }

    frame.addEventListener("mousedown", onDown as EventListener);
    window.addEventListener("mousemove", onMove as EventListener);
    window.addEventListener("mouseup", onUp);

    frame.addEventListener("touchstart", onDown as EventListener, { passive: true });
    window.addEventListener("touchmove", onMove as EventListener, { passive: false });
    window.addEventListener("touchend", onUp);

    window.addEventListener("resize", sizeClipImg);
    sizeClipImg();

    return () => {
      frame.removeEventListener("mousedown", onDown as EventListener);
      window.removeEventListener("mousemove", onMove as EventListener);
      window.removeEventListener("mouseup", onUp);
      frame.removeEventListener("touchstart", onDown as EventListener);
      frame.removeEventListener("touchmove", onMove as EventListener);
      frame.removeEventListener("touchend", onUp);
      window.removeEventListener("resize", sizeClipImg);
    };
  }, [sizeClipImg]);

  /* ── Facility carousel (mobile) ── */
  const facilityTrackRef = useRef<HTMLDivElement>(null);
  const [facilityActive, setFacilityActive] = useState(0);

  useEffect(() => {
    const track = facilityTrackRef.current;
    if (!track) return;
    const onScroll = () => {
      const center = track.scrollLeft + track.clientWidth / 2;
      const cards = Array.from(track.querySelectorAll<HTMLElement>(".facility-card"));
      let nearest = 0, min = Infinity;
      cards.forEach((el, i) => {
        const cardCenter = el.offsetLeft + el.offsetWidth / 2;
        const dist = Math.abs(cardCenter - center);
        if (dist < min) { min = dist; nearest = i; }
      });
      setFacilityActive(nearest);
    };
    track.addEventListener("scroll", onScroll, { passive: true });
    return () => track.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToFacility = (i: number) => {
    const track = facilityTrackRef.current;
    if (!track) return;
    const cards = track.querySelectorAll<HTMLElement>(".facility-card");
    cards[i]?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  };

  /* ── Facility/weather card glow-follow-cursor ── */
  useEffect(() => {
    const cards = document.querySelectorAll<HTMLElement>(".facility-card, .weather-card");
    if (!cards.length) return;
    function onMove(e: MouseEvent) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      (e.currentTarget as HTMLElement).style.setProperty(
        "--mx",
        e.clientX - rect.left + "px",
      );
      (e.currentTarget as HTMLElement).style.setProperty(
        "--my",
        e.clientY - rect.top + "px",
      );
    }
    cards.forEach((card) => card.addEventListener("mousemove", onMove));
    return () => cards.forEach((card) => card.removeEventListener("mousemove", onMove));
  }, []);

  return (
    <div style={{ fontFamily: FONT_FAMILY }}>
      <style>{SITE_CSS}</style>

      {/* ── 01: Cinematic Orbit Hero ── */}
      <CinematicOrbitHero />

      {/* ── 02: Venue Points (membership-style statements) ── */}
      <section style={{ background: '#F9FAFB', padding: 'clamp(88px, 12vw, 140px) 24px' }}>
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-12">
          {[
            { lead: t('venue_point_1_lead'), body: t('venue_point_1_body') },
            { lead: t('venue_point_2_lead'), body: t('venue_point_2_body') },
            { lead: t('venue_point_3_lead'), body: t('venue_point_3_body') },
            { lead: t('venue_point_4_lead'), body: t('venue_point_4_body') },
            { lead: t('venue_point_5_lead'), body: t('venue_point_5_body') },
          ].map((point, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.7, delay: i * 0.1, ease: [0.2, 0.7, 0.3, 1] }}
              className="text-center"
            >
              <div className="space-y-2">
                <p
                  className="text-3xl font-semibold leading-tight md:text-5xl"
                  style={{ color: '#059669' }}
                >
                  {point.lead}
                </p>
                <p
                  className="text-3xl font-semibold leading-tight md:text-5xl"
                  style={{ color: '#111827' }}
                >
                  {point.body}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── 03: Two-room comparison ── */}
      <section className="room-comparison-section">
        <div className="room-comparison-inner">
          {/* Left column: heading + features */}
          <div className="room-comparison-text">
            <h2 className="room-comparison-heading" data-cms-key="room_comparison_heading">
              {t("room_comparison_heading")}
            </h2>
            <p className="room-comparison-intro" data-cms-key="room_comparison_intro">
              {t("room_comparison_intro")}
            </p>

            <div className="room-comparison-features">
              <div className="room-feature">
                <div className="room-feature-label">{t('room_feature_area_label')}</div>
                <div className="room-feature-value">{t('room_feature_area_value')}</div>
              </div>
              <div className="room-feature">
                <div className="room-feature-label">{t('room_feature_table_label')}</div>
                <div className="room-feature-value">{t('room_feature_table_value')}</div>
              </div>
              <div className="room-feature">
                <div className="room-feature-label">{t('room_feature_quality_label')}</div>
                <div className="room-feature-value">{t('room_feature_quality_value')}</div>
              </div>
              <div className="room-feature">
                <div className="room-feature-label">{t('room_feature_capacity_label')}</div>
                <div className="room-feature-value">{t('room_feature_capacity_value')}</div>
              </div>
            </div>
          </div>

          {/* Right column: slider */}
          <div className="room-comparison-slider">
            <Reveal2
              beforeImage={{
                src: "/images/venue-page-infinity.jpg",
                alt: "Space Infinity 包廂內部",
              }}
              afterImage={{
                src: "/images/venue-page-eternity.jpg",
                alt: "Space Eternity 包廂內部",
              }}
            />
          </div>
        </div>
      </section>

      {/* ── 04: 其他設施 carousel ── */}
      <AppleCardCarousel
        heading={t("other_facilities_heading")}
        cards={[
          {
            id: "1",
            title: t("other_facilities_sofa_title"),
            src: "/images/sofa-lounge-中八桌球-香港新蒲崗.webp",
            alt: "休息區梳化",
            aspectRatio: "3 / 4",
            objectFit: "cover",
            desc: t("other_facilities_sofa_desc"),
          },
          {
            id: "2",
            title: t("other_facilities_cue_title"),
            src: "/images/cue-stand-中八桌球-香港新蒲崗.webp",
            alt: "球桿架設施",
            aspectRatio: "3 / 4",
            objectFit: "cover",
            desc: t("other_facilities_cue_desc"),
          },
          {
            id: "3",
            title: t("other_facilities_pilot_title"),
            titleFont: '"Good Times", sans-serif',
            src: "/images/space-pilot-scoreboard-中八桌球-香港新蒲崗.webp",
            alt: "Space Pilot 智能計分系統",
            aspectRatio: "3 / 4",
            objectFit: "contain",
            desc: t("other_facilities_pilot_desc"),
          },
          {
            id: "4",
            title: t("other_facilities_table_title"),
            src: "/images/pool-table-closeup-中八桌球-香港新蒲崗.webp",
            alt: "專業球臺特寫",
            aspectRatio: "3 / 4",
            objectFit: "cover",
            desc: t("other_facilities_table_desc"),
          },
          {
            id: "5",
            title: t("other_facilities_room_title"),
            src: "/images/space-infinity-room-中八桌球-香港新蒲崗.webp",
            alt: "包廂空間",
            aspectRatio: "3 / 4",
            objectFit: "cover",
            desc: t("other_facilities_room_desc"),
          },
        ]}
      />

      {/* ── 05: Pricing (dark variant) ── */}
      {periods && periods.length > 0 && (
        <HomePricing periods={periods} variant="dark" />
      )}

      {/* ── Notes ── */}
      <section className="notes-section" data-nav-theme="dark">
        <div className="notes-inner">
          <h2 className="notes-title">{t("rules_title")}</h2>
          <ul className="notes-list">
            {rules.map((rule, i) => (
              <li key={i}>
                <span className="notes-num">{i + 1}</span>
                <p>{rule}</p>
              </li>
            ))}
          </ul>
          <a
            className="notes-link"
            href="https://space8.com.hk/legal"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("rules_link")}
          </a>
        </div>
      </section>

      {/* ── Weather ── */}
      <section className="weather-section" data-nav-theme="dark">
        <div className="weather-inner">
          <div className="weather-card" id="weatherCard">
            <div className="weather-header" id="weatherHeader">
              <div className="weather-icon si-cloud">
                <CloudRain size={52} strokeWidth={1.7} />
              </div>
              <h2 className="weather-title">{t("weather_title")}</h2>
            </div>

            <div className="weather-body">
              <div className="weather-block">
                <p className="weather-head">
                  {t('weather_severe_title')}
                </p>
                <ul className="weather-list">
                  <li>{t('weather_severe_point_1')}</li>
                  <li>{t('weather_severe_point_2')}</li>
                  <li>{t('weather_severe_point_3')}</li>
                </ul>
              </div>

              <div className="weather-block">
                <p className="weather-head">
                  {t('weather_normal_title')}
                </p>
                <ul className="weather-list">
                  <li>{t('weather_normal_point_1')}</li>
                </ul>
              </div>
            </div>
            <a
              className="notes-link"
              href="https://space8.com.hk/legal"
              target="_blank"
              rel="noopener noreferrer"
              style={{ marginTop: "28px", display: "inline-block" }}
            >
              {t("rules_link")}
            </a>
          </div>
        </div>
      </section>

      {/* ── Directions ── */}
      <section className="dir-section" data-nav-theme="light">
        <div className="dir-inner">
          <div className="dir-layout">
            <div className="dir-card">
              <div className="dir-header">
                <div className="dir-pin si-pin">
                  <MapPin size={38} strokeWidth={1.8} />
                </div>
                <h2 className="dir-title">{t("directions_title")}</h2>
              </div>

              <p className="dir-address">{t('address')}</p>

              <ul className="dir-notes">
                <li>{t('directions_note_1')}</li>
                <li>{t('directions_note_2')}</li>
                <li>{t('directions_note_3')}</li>
                <li>{t('directions_note_4')}</li>
              </ul>

              <div className="dir-actions">
                <a
                  className="dir-btn primary"
                  href={MAPS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MapPin size={17} strokeWidth={1.9} />
                  {t('map_cta')}
                </a>
                <Link href="/book" className="dir-btn ghost">
                  {t("book_cta")}
                </Link>
              </div>
            </div>

            <div className="dir-map">
              <iframe
                src={`https://maps.google.com/maps?q=${encodeURIComponent("香港新蒲崗大有街32號泰力工業中心")}&t=&z=17&ie=UTF8&iwloc=&output=embed`}
                title="泰力工業中心位置地圖"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}