"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { motion, useScroll, useTransform } from "framer-motion";
import { Link } from "@/i18n/navigation";
import {
  Target,
  Lightbulb,
  Thermometer,
  Wifi,
  CupSoda,
  QrCode,
  BadgeCheck,
  MousePointerClick,
  CalendarCheck,
  MessageCircle,
  MapPin,
  CloudRain,
  ChevronRight,
  Star,
  Sun,
  Moon,
} from "lucide-react";

const DARK = "#1D1D1F";
const SUBTLE = "#6e6e73";
const GOLD = "#1a9d5c";
const GOLD_BRIGHT = "#22b86b";

const FONT_FAMILY =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Helvetica, Arial, sans-serif";

const EASE = [0.16, 1, 0.3, 1] as const;
const VIEWPORT = { once: true, amount: 0.25 } as const;

const ADDRESS = "香港新蒲崗大有街 32 號泰力工業中心 3 樓 05 室";
const MAPS_URL = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
  "泰力工業中心 32 Tai Yau Street, San Po Kong, Hong Kong",
)}`;

const FACILITY_ICONS = [Target, Lightbulb, Thermometer, Wifi, CupSoda, QrCode];
const FACILITY_ICON_CLASSES = ['si-target', 'si-bulb', 'si-therm', 'si-wifi', 'si-cup', 'si-qr'];
const SERVICE_ICONS = [BadgeCheck, MousePointerClick, CalendarCheck, MessageCircle];
const SERVICE_ICON_CLASSES = ['si-badge', 'si-click', 'si-cal', 'si-message'];

type TitledItem = { title: string; body: string };

/* ── Injected CSS matching reference HTML exactly ── */
const SITE_CSS = `
/* ===== VIDEO HERO (scroll-scrub) ===== */
.hero-video-wrapper {
  position: relative;
  height: 400vh;
}
.hero-video-sticky {
  position: sticky;
  top: 0;
  height: 100dvh;
  overflow: hidden;
}
.hero-video-el {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.hero-video-overlay {
  position: absolute;
  inset: 0;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  pointer-events: none;
  padding: 0 24px;
}
.hero-video-overlay * { pointer-events: auto; }
.hero-headline {
  font-family: 'Noto Sans TC', sans-serif;
  font-weight: 900;
  font-size: clamp(2.5rem, 8vw, 5.5rem);
  line-height: 1.15;
  letter-spacing: 0.01em;
  color: #ffffff;
  margin: 0;
  text-shadow: 0 2px 20px rgba(0,0,0,0.35);
}
.hero-tagline {
  font-family: 'SF Pro Text', 'Noto Sans TC', sans-serif;
  font-weight: 500;
  font-size: clamp(14px, 2.5vw, 18px);
  color: rgba(255,255,255,0.7);
  margin-top: 14px;
  letter-spacing: 0.04em;
}
.hero-cta {
  display: inline-block;
  margin-top: 24px;
  font-family: 'Noto Sans TC', sans-serif;
  font-size: clamp(15px, 2vw, 17px);
  font-weight: 500;
  padding: 15px 36px;
  border-radius: 999px;
  background: #22C55E;
  color: #ffffff;
  text-decoration: none;
  box-shadow: 0 8px 30px -8px rgba(34,197,94,0.4);
  transition: transform .35s cubic-bezier(.2,.7,.3,1), box-shadow .35s ease;
  cursor: pointer;
}
.hero-cta:hover { transform: translateY(-2px); box-shadow: 0 12px 36px -6px rgba(34,197,94,0.55); }
.hero-black-overlay {
  position: absolute;
  inset: 0;
  background: #000000;
  z-index: 5;
  pointer-events: none;
}
@media (prefers-reduced-motion: reduce) {
  .hero-video-wrapper { height: auto; }
  .hero-video-sticky { position: relative; height: auto; min-height: 100dvh; }
  .hero-video-el { display: block; position: relative; height: 100dvh; }
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

/* ===== FACILITY ===== */
.facility-section {
  background: #000000;
  padding: 110px 24px 130px;
}
.facility-inner { max-width: 1100px; margin: 0 auto; }
.facility-title {
  font-family: 'Noto Sans TC', sans-serif;
  font-weight: 900;
  font-size: clamp(1.7rem, 3.4vw, 2.4rem);
  color: #f5f2ec;
  margin-bottom: 48px;
}
.facility-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}
.facility-card {
  position: relative;
  border-radius: 16px;
  background: #0d0d0f;
  border: 1px solid rgba(255,255,255,0.08);
  padding: 32px 28px 30px;
  overflow: hidden;
}
.facility-card::before {
  content: "";
  position: absolute; inset: 0;
  border-radius: inherit;
  padding: 1px;
  background: radial-gradient(260px circle at var(--mx,50%) var(--my,50%), rgba(34,184,107,0.85), transparent 62%);
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  opacity: 0;
  transition: opacity .35s ease;
  pointer-events: none;
}
.facility-card::after {
  content: "";
  position: absolute; inset: 0;
  border-radius: inherit;
  background: radial-gradient(320px circle at var(--mx,50%) var(--my,50%), rgba(34,184,107,0.08), transparent 65%);
  opacity: 0;
  transition: opacity .35s ease;
  pointer-events: none;
}
.facility-card:hover::before,
.facility-card:hover::after { opacity: 1; }
.facility-icon { width: 26px; height: 26px; color: #22b86b; margin-bottom: 22px; }
.facility-icon svg { width: 100%; height: 100%; display: block; }
.facility-card h3 {
  font-family: 'Noto Sans TC', sans-serif;
  font-weight: 700;
  font-size: 16.5px;
  color: #f5f2ec;
  margin: 0 0 10px;
}
.facility-card p {
  font-size: 13.5px;
  line-height: 1.7;
  color: rgba(245,242,236,0.5);
  margin: 0;
}
@media (max-width: 860px) { .facility-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 560px) { .facility-grid { grid-template-columns: 1fr; } }

/* ===== COMPARISON SLIDER (matches reference HTML exactly) ===== */
.compare-section {
  background: #1d1d1f;
  padding: 110px 24px 130px;
}
.compare-inner { max-width: 1100px; margin: 0 auto; }
.compare-title {
  font-family: 'Noto Sans TC', sans-serif;
  font-weight: 900;
  font-size: clamp(1.7rem, 3.4vw, 2.4rem);
  color: #f5f2ec;
  margin-bottom: 12px;
}
.compare-sub {
  font-size: 14.5px;
  color: rgba(245,242,236,0.5);
  margin-bottom: 36px;
}
.compare-frame {
  position: relative;
  width: 100%;
  aspect-ratio: 1600 / 1143;
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid rgba(255,255,255,0.14);
  box-shadow: 0 24px 60px -20px rgba(0,0,0,0.55);
  user-select: none;
  -webkit-user-select: none;
  touch-action: pan-y;
  cursor: ew-resize;
  background: #0d0d0f;
}
.compare-frame img {
  position: absolute; inset: 0;
  width: 100%; height: 100%;
  object-fit: cover;
  display: block;
  pointer-events: none;
  -webkit-user-drag: none;
}
.compare-clip {
  position: absolute; inset: 0;
  overflow: hidden;
  width: 50%;
  will-change: width;
  z-index: 2;
}
.compare-clip img {
  width: 100%; height: 100%;
  max-width: none;
}
.compare-clip-inner {
  position: absolute;
  top: 0; left: 0;
  height: 100%;
  will-change: width;
}
.compare-label {
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%,-50%);
  font-family: 'Inter', sans-serif;
  font-weight: 900;
  font-size: clamp(1.7rem, 7vw, 4.6rem);
  letter-spacing: 0.02em;
  line-height: 1.05;
  text-transform: uppercase;
  text-align: center;
  white-space: nowrap;
  color: #ffffff;
  text-shadow: 0 4px 30px rgba(0,0,0,0.55);
  pointer-events: none;
}
.compare-label.right { z-index: 1; }
.compare-handle {
  position: absolute;
  top: 0; bottom: 0;
  width: 2px;
  background: rgba(255,255,255,0.9);
  box-shadow: 0 0 14px rgba(0,0,0,0.5);
  transform: translateX(-50%);
  pointer-events: none;
  z-index: 5;
}
.compare-grip {
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%,-50%);
  width: 42px; height: 42px;
  border-radius: 50%;
  background: #ffffff;
  box-shadow: 0 4px 20px rgba(0,0,0,0.45);
  display: flex; align-items: center; justify-content: center;
  gap: 3px;
}
.compare-grip span {
  display: block;
  width: 0; height: 0;
  border-top: 5px solid transparent;
  border-bottom: 5px solid transparent;
}
.compare-grip span.l { border-right: 7px solid #111110; }
.compare-grip span.r { border-left: 7px solid #111110; }
.compare-captions {
  display: flex;
  justify-content: space-between;
  gap: 24px;
  margin-top: 22px;
}
.compare-caption {
  font-family: 'Noto Sans TC', sans-serif;
  font-size: 15px;
  font-weight: 700;
  color: #f5f2ec;
}
.compare-caption.right { text-align: right; }
.compare-caption span {
  display: block;
  font-weight: 400;
  font-size: 13px;
  color: rgba(245,242,236,0.5);
  margin-top: 5px;
}
@media (max-width: 560px) {
  .compare-captions { gap: 14px; }
  .compare-caption { font-size: 13.5px; }
  .compare-caption span { font-size: 12px; }
  .compare-label { font-size: clamp(1.1rem, 7.5vw, 2rem); letter-spacing: 0.01em; }
  .compare-grip { width: 30px; height: 30px; }
  .compare-grip span { border-top-width: 4px; border-bottom-width: 4px; }
  .compare-grip span.l { border-right-width: 5px; }
  .compare-grip span.r { border-left-width: 5px; }
  .compare-handle { width: 2px; }
}
@media (max-width: 380px) { .compare-grip { width: 26px; height: 26px; } }

/* ===== SERVICE ===== */
.service-section {
  background: #ffffff;
  padding: 120px 24px 140px;
}
.service-inner { max-width: 1160px; margin: 0 auto; }
.service-title {
  font-family: 'Noto Sans TC', sans-serif;
  font-weight: 900;
  font-size: clamp(1.7rem, 3.4vw, 2.4rem);
  color: #111110;
  margin-bottom: 56px;
}
.service-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 22px;
}
.service-card {
  position: relative;
  background: #ffffff;
  border: 1px solid rgba(17,17,16,0.10);
  border-radius: 18px;
  padding: 30px 26px 28px;
  box-shadow: 0 1px 2px rgba(17,17,16,0.04);
  opacity: 0;
  transform: translateY(-46px) scale(1.05) rotate(-4deg);
  transform-origin: 50% 120%;
  transition: opacity .5s ease,
              transform .78s cubic-bezier(.28,1.5,.52,1),
              box-shadow .35s ease,
              border-color .35s ease;
}
.service-card:nth-child(2) { transform: translateY(-52px) scale(1.05) rotate(3deg); }
.service-card:nth-child(3) { transform: translateY(-44px) scale(1.05) rotate(-2.5deg); }
.service-card:nth-child(4) { transform: translateY(-56px) scale(1.05) rotate(3.5deg); }
.service-card.is-visible,
.service-card:nth-child(2).is-visible,
.service-card:nth-child(3).is-visible,
.service-card:nth-child(4).is-visible {
  opacity: 1;
  transform: translateY(0) scale(1) rotate(0deg);
}
.service-card:hover {
  border-color: rgba(26,157,92,0.45);
  box-shadow: 0 18px 40px -18px rgba(17,17,16,0.28);
}
.service-step {
  font-family: 'JetBrains Mono', 'Noto Sans TC', monospace;
  font-size: 11px;
  letter-spacing: 0.14em;
  color: rgba(17,17,16,0.35);
  margin-bottom: 20px;
}
.service-icon { width: 26px; height: 26px; color: #1a9d5c; margin-bottom: 18px; }
.service-icon svg { width: 100%; height: 100%; display: block; }
.service-card h3 {
  font-family: 'Noto Sans TC', sans-serif;
  font-weight: 700;
  font-size: 16.5px;
  color: #111110;
  margin: 0 0 10px;
}
.service-card p {
  font-size: 13.5px;
  line-height: 1.75;
  color: rgba(17,17,16,0.58);
  margin: 0;
}
@media (max-width: 900px) { .service-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 560px) {
  .service-grid { grid-template-columns: 1fr; gap: 16px; }
  .service-section { padding: 90px 24px 100px; }
  .service-title { margin-bottom: 40px; }
}
@media (prefers-reduced-motion: reduce) {
  .service-card,
  .service-card:nth-child(2),
  .service-card:nth-child(3),
  .service-card:nth-child(4) {
    opacity: 1;
    transform: none;
    transition: none;
  }
}

/* ===== PRICING ===== */
.rate-section {
  background: #e8e8e8;
  padding: 120px 24px 130px;
}
.rate-inner { max-width: 1120px; margin: 0 auto; }
.rate-layout {
  display: grid;
  grid-template-columns: 0.82fr 1.18fr;
  gap: 56px;
  align-items: start;
}
.rate-title {
  font-family: 'Noto Sans TC', sans-serif;
  font-weight: 900;
  font-size: clamp(1.8rem, 3.8vw, 2.6rem);
  color: #111110;
  margin-bottom: 14px;
}
.rate-sub {
  font-family: 'Noto Sans TC', sans-serif;
  font-size: 14.5px;
  line-height: 1.85;
  color: rgba(17,17,16,0.58);
  margin-bottom: 26px;
  max-width: 30ch;
}
.rate-note {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-family: 'Noto Sans TC', sans-serif;
  font-size: 13px;
  line-height: 1.75;
  color: rgba(17,17,16,0.50);
  padding: 14px 16px;
  background: rgba(255,255,255,0.7);
  border: 1px solid rgba(17,17,16,0.09);
  border-radius: 12px;
  margin-bottom: 28px;
}
.rate-note svg { width: 16px; height: 16px; flex-shrink: 0; color: #1a9d5c; margin-top: 2px; }
.rate-cta {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  background: linear-gradient(180deg, #22b86b, #1a9d5c);
  color: #fff;
  font-family: 'Noto Sans TC', sans-serif;
  font-size: 15px;
  font-weight: 500;
  padding: 15px 34px;
  border-radius: 999px;
  text-decoration: none;
  box-shadow: 0 12px 30px -12px rgba(26,157,92,0.65);
  transition: transform .35s cubic-bezier(.2,.7,.3,1), box-shadow .35s ease;
}
.rate-cta:hover { transform: translateY(-2px); box-shadow: 0 18px 38px -12px rgba(26,157,92,0.75); }
.rate-cta svg { width: 16px; height: 16px; }
.rate-panel {
  background: #ffffff;
  border: 1px solid rgba(17,17,16,0.10);
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(17,17,16,0.05);
}
.rate-row {
  position: relative;
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 20px;
  padding: 26px 28px;
  transition: background .35s ease;
}
.rate-row + .rate-row { border-top: 1px solid rgba(17,17,16,0.09); }
.rate-row:hover { background: rgba(26,157,92,0.045); }
.rate-row.is-best { background: rgba(26,157,92,0.07); }
.rate-row.is-best:hover { background: rgba(26,157,92,0.10); }
.rate-row.is-best::before {
  content: "";
  position: absolute; left: 0; top: 0; bottom: 0;
  width: 3px; background: #1a9d5c;
}
.rate-ic {
  width: 42px; height: 42px;
  border-radius: 12px;
  background: rgba(26,157,92,0.11);
  color: #1a9d5c;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.rate-ic svg { width: 21px; height: 21px; display: block; overflow: visible; }
.rate-meta h3 {
  display: flex;
  align-items: center;
  gap: 9px;
  font-family: 'Noto Sans TC', sans-serif;
  font-weight: 700;
  font-size: 16.5px;
  color: #111110;
  margin: 0 0 5px;
}
.rate-tag {
  font-family: 'Noto Sans TC', sans-serif;
  font-size: 10.5px;
  font-weight: 700;
  color: #fff;
  background: #1a9d5c;
  padding: 3px 9px;
  border-radius: 999px;
  white-space: nowrap;
}
.rate-meta p {
  font-family: 'Inter', 'Noto Sans TC', sans-serif;
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
  font-family: 'Inter', 'Noto Sans TC', sans-serif;
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
  .rate-section { padding: 86px 20px 96px; }
  .rate-row { grid-template-columns: auto 1fr; gap: 14px; padding: 22px 20px; }
  .rate-price { grid-column: 1 / -1; text-align: left; padding-left: 56px; margin-top: -4px; }
  .rate-price b { font-size: 1.5rem; }
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
  border: 1px solid rgba(34,184,107,0.55);
  color: #22b86b;
  font-family: 'Inter', sans-serif;
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
  .notes-section { padding: 90px 24px 100px; }
  .notes-title { margin-bottom: 34px; }
  .notes-list li { gap: 14px; padding: 18px 2px; }
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
  .weather-section { padding: 90px 24px 100px; }
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
  .dir-section { padding: 90px 24px 100px; }
  .dir-card { padding: 30px 24px 32px; border-radius: 16px; }
  .dir-header { gap: 12px; margin-bottom: 22px; }
  .dir-pin { width: 30px; height: 30px; }
  .dir-map { border-radius: 16px; }
  .dir-actions { gap: 10px; }
  .dir-btn { padding: 13px 20px; font-size: 13.5px; }
  .venue-dir-cta-button { width: 100% !important; min-height: 48px !important; justify-content: center !important; }
}
`;

export default function VenueContent() {
  const t = useTranslations("venuePage");
  const facilities = t.raw("facilities") as TitledItem[];
  const services = t.raw("services") as TitledItem[];
  const rules = t.raw("rules") as string[];

  /* ── Video hero scroll-scrub ── */
  const videoHeroWrapperRef = useRef<HTMLDivElement>(null);
  const desktopVideoRef = useRef<HTMLVideoElement>(null);
  const mobileVideoRef = useRef<HTMLVideoElement>(null);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduceMotion(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const { scrollYProgress } = useScroll({
    target: videoHeroWrapperRef,
    offset: ["start start", "end end"],
  });

  useEffect(() => {
    const isDesktop = () => window.matchMedia("(min-width: 768px)").matches;

    const updateFrame = () => {
      const progress = scrollYProgress.get();
      const activeVideo = isDesktop() ? desktopVideoRef.current : mobileVideoRef.current;
      if (activeVideo && activeVideo.duration) {
        activeVideo.currentTime = progress * activeVideo.duration;
      }
    };

    const unsubscribe = scrollYProgress.on("change", () => {
      requestAnimationFrame(updateFrame);
    });

    const handleResize = () => updateFrame();
    window.addEventListener("resize", handleResize);

    return () => {
      unsubscribe();
      window.removeEventListener("resize", handleResize);
    };
  }, [scrollYProgress]);

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

  /* ── Service card sequential reveal (matches reference HTML) ── */
  const serviceGridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const grid = serviceGridRef.current;
    if (!grid) return;
    const cards = Array.from(grid.querySelectorAll(".service-card"));
    if (!cards.length) return;

    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      !("IntersectionObserver" in window)
    ) {
      cards.forEach((c) => c.classList.add("is-visible"));
      return;
    }

    let revealed = 0;

    function revealUpTo(index: number) {
      while (revealed <= index) {
        const card = cards[revealed];
        const order = revealed;
        setTimeout(() => {
          card.classList.add("is-visible");
        }, order * 165);
        revealed++;
      }
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const i = cards.indexOf(entry.target as HTMLElement);
          if (i > -1) revealUpTo(i);
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.25, rootMargin: "0px 0px -8% 0px" },
    );

    cards.forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, []);

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

      {/* ── Video Hero: scroll-scrubbed, dual-video, white text on dark ── */}
      <div ref={videoHeroWrapperRef} className="hero-video-wrapper" data-nav-theme="dark">
        <div className="hero-video-sticky">
          {/* Desktop video (hidden on mobile) */}
          <video
            ref={desktopVideoRef}
            src="/video/Venue_Hero/Venue_Hero_Desktop.mp4"
            className="hero-video-el hidden md:block"
            muted
            playsInline
            preload="auto"
            poster="/video/Venue_Hero/Venue_Hero_Desktop_poster.jpg"
          />
          {/* Mobile video (hidden on desktop) */}
          <video
            ref={mobileVideoRef}
            src="/video/Venue_Hero/Venue_Hero_Mobile.mp4"
            className="hero-video-el block md:hidden"
            muted
            playsInline
            preload="auto"
            poster="/video/Venue_Hero/Venue_Hero_Mobile_poster.jpg"
          />

          {/* Safety black overlay — fades in at the very end to guarantee a clean cut */}
          <motion.div
            className="hero-black-overlay"
            style={{ opacity: useTransform(scrollYProgress, [0.97, 1], [0, 1]) }}
          />

          {/* Text overlay layer — sits above both videos */}
          {!reduceMotion ? (
            <>
              <motion.div
                className="hero-video-overlay"
                style={{
                  opacity: useTransform(scrollYProgress, [0, 0.25, 0.32, 0.55, 0.62, 1], [0, 0, 1, 1, 0, 0]),
                  y: useTransform(scrollYProgress, [0.25, 0.32], [20, 0]),
                }}
              >
                <h1 className="hero-headline">空間全開，由你主場</h1>
              </motion.div>

              <motion.div
                className="hero-video-overlay"
                style={{
                  opacity: useTransform(scrollYProgress, [0, 0.30, 0.37, 0.55, 0.62, 1], [0, 0, 1, 1, 0, 0]),
                  y: useTransform(scrollYProgress, [0.30, 0.37], [20, 0]),
                }}
              >
                <p className="hero-tagline">自助入場 · 無菸環境</p>
              </motion.div>

              <motion.div
                className="hero-video-overlay"
                style={{
                  opacity: useTransform(scrollYProgress, [0, 0.34, 0.40, 0.55, 0.62, 1], [0, 0, 1, 1, 0, 0]),
                  scale: useTransform(scrollYProgress, [0.34, 0.40], [0.95, 1]),
                }}
              >
                <Link href="/book" className="hero-cta">立即預訂</Link>
              </motion.div>
            </>
          ) : (
            /* Reduced motion: show static content immediately */
            <div className="hero-video-overlay">
              <h1 className="hero-headline">空間全開，由你主場</h1>
              <p className="hero-tagline">自助入場 · 無菸環境</p>
              <Link href="/book" className="hero-cta">立即預訂</Link>
            </div>
          )}
        </div>
      </div>

      {/* ── Below-hero content (after hero releases, before facility) ── */}
      <section className="hero-after-section" data-nav-theme="dark">
        <div className="hero-after-inner">
          <h2 className="hero-after-title">自助中式桌球<br />獨立球室</h2>
          <p className="hero-after-body">
            獨立球室，無多餘干擾。一顆球、一支桿、一段不被打斷的時間，掃碼開門，燈光為你亮起。
          </p>
        </div>
      </section>

      {/* ── Facilities ── */}
      <section className="facility-section" data-nav-theme="dark">
        <div className="facility-inner">
          <h2 className="facility-title">{t("facilities_title")}</h2>
          <div className="facility-grid">
            {facilities.map((item, i) => {
              const Icon = FACILITY_ICONS[i] ?? Target;
              const iconClass = FACILITY_ICON_CLASSES[i] ?? '';
              return (
                <div key={item.title} className="facility-card">
                  <div className={`facility-icon ${iconClass}`}>
                    <Icon size={26} strokeWidth={1.8} />
                  </div>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Comparison: 兩間 1T 獨立球室 (drag slider, matches reference HTML exactly) ── */}
      <section className="compare-section" data-nav-theme="dark">
        <div className="compare-inner">
          <h2 className="compare-title">兩間 1T 獨立球室</h2>
          <p className="compare-sub">拖動滑桿以觀看兩間球室</p>

          <div ref={compareRef} className="compare-frame" id="compareFrame">
            {/* Full image (Space Eternity side) */}
            <Image
              src="/gallery/Space_Enternity.PNG"
              alt="Space Eternity（永恆空間球室）"
              fill
              sizes="(max-width: 720px) 100vw, 1100px"
              priority
            />

            {/* Clip overlay (Space Infinity side) */}
            <div className="compare-clip" id="compareClip" style={{ width: `${sliderPos}%` }}>
              <div className="compare-clip-inner" id="compareClipInner">
                <Image
                  src="/gallery/Space_Infinity.PNG"
                  alt="Space Infinity（無限空間球室）"
                  fill
                  sizes="(max-width: 720px) 100vw, 1100px"
                  priority
                />
              </div>
            </div>

            {/* Handle */}
            <div className="compare-handle" id="compareHandle" style={{ left: `${sliderPos}%` }}>
              <div className="compare-grip">
                <span className="l" />
                <span className="r" />
              </div>
            </div>
          </div>

          <div className="compare-captions">
            <div className="compare-caption left">
              Space Infinity
              <span>無限空間球室</span>
            </div>
            <div className="compare-caption right">
              Space Eternity
              <span>永恆空間球室</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Service (matches reference HTML) ── */}
      <section className="service-section" data-nav-theme="light">
        <div className="service-inner">
          <h2 className="service-title">{t("services_title")}</h2>
          <div ref={serviceGridRef} className="service-grid" id="serviceGrid">
            {services.map((item, i) => {
              const Icon = SERVICE_ICONS[i] ?? BadgeCheck;
              const iconClass = SERVICE_ICON_CLASSES[i] ?? '';
              return (
                <div key={item.title} className="service-card">
                  <div className="service-step">
                    {i === 0
                      ? "STEP 01"
                      : i === 1
                        ? "STEP 02"
                        : i === 2
                          ? "STEP 03"
                          : "如有需要"}
                  </div>
                  <div className={`service-icon ${iconClass}`}>
                    <Icon size={26} strokeWidth={1.8} />
                  </div>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Pricing (matches reference HTML) ── */}
      <section className="rate-section" id="rateSection" data-nav-theme="light">
        <div className="rate-inner">
          <div className="rate-layout">
            <div className="rate-intro">
              <h2 className="rate-title">定價。</h2>
              <p className="rate-sub">
                按時段收費，愈連訂愈抵玩。所有時段均為獨立球室，價格已包全場設施。
              </p>
              <div className="rate-note">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="9.2" />
                  <path d="M12 16v-4.5" />
                  <path d="M12 8.2h.01" />
                </svg>
                <span>連訂 2 小時或以上可享優惠價，於預訂時自動計算。</span>
              </div>
              <Link href="/book" className="rate-cta">
                立即預訂
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12h14" />
                  <path d="m13 6 6 6-6 6" />
                </svg>
              </Link>
            </div>

            <div className="rate-panel">
              <div className="rate-row is-best">
                <div className="rate-ic">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="4.1" />
                    <g>
                      <line x1="12" y1="1.6" x2="12" y2="3.8" />
                      <line x1="12" y1="20.2" x2="12" y2="22.4" />
                      <line x1="1.6" y1="12" x2="3.8" y2="12" />
                      <line x1="20.2" y1="12" x2="22.4" y2="12" />
                      <line x1="4.6" y1="4.6" x2="6.2" y2="6.2" />
                      <line x1="17.8" y1="17.8" x2="19.4" y2="19.4" />
                      <line x1="4.6" y1="19.4" x2="6.2" y2="17.8" />
                      <line x1="17.8" y1="6.2" x2="19.4" y2="4.6" />
                    </g>
                  </svg>
                </div>
                <div className="rate-meta">
                  <h3>
                    上午時段 <span className="rate-tag">最抵玩</span>
                  </h3>
                  <p>每日 06:00–12:00</p>
                  <span className="rate-deal">
                    連訂 2 小時或以上 <b>HK$78</b>
                  </span>
                </div>
                <div className="rate-price">
                  <b>HK$88</b>
                  <span>/ 小時</span>
                </div>
              </div>

              <div className="rate-row">
                <div className="rate-ic">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="7" fill="currentColor" stroke="none" />
                    <path d="M14.6 2.6 6.4 13.4h5.2l-2.2 8 8.2-10.8h-5.2z" />
                  </svg>
                </div>
                <div className="rate-meta">
                  <h3>下午時段</h3>
                  <p>每日 12:00–16:00</p>
                  <span className="rate-deal">
                    連訂 2 小時或以上 <b>HK$88</b>
                  </span>
                </div>
                <div className="rate-price">
                  <b>HK$98</b>
                  <span>/ 小時</span>
                </div>
              </div>

              <div className="rate-row">
                <div className="rate-ic">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M20.4 14.6A8.6 8.6 0 0 1 9.4 3.6a8.6 8.6 0 1 0 11 11z" />
                    <circle cx="17.6" cy="5.2" r="1" fill="currentColor" stroke="none" />
                    <circle cx="20.4" cy="9.4" r="0.8" fill="currentColor" stroke="none" />
                  </svg>
                </div>
                <div className="rate-meta">
                  <h3>黃金時段</h3>
                  <p>每日 16:00–00:00</p>
                </div>
                <div className="rate-price">
                  <b>HK$108</b>
                  <span>/ 小時</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

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
                  颱風警告信號 No. 8 或以上 / 黑色暴雨警告
                </p>
                <ul className="weather-list">
                  <li>
                    <b>如常開放</b>：我們的場地自動化系統會維持正常運作。若您評估路面與天氣狀況安全，歡迎按原定時間前來。
                  </li>
                  <li>
                    <b>貼心改期</b>：若您評估後希望留在室內休息，請於原本預約時間開始前透過 WhatsApp 聯絡線上客服。我們非常樂意為您安排在 7 天內免費改期一次（本方案不設退款）。
                  </li>
                  <li>
                    <b>溫馨提示</b>：為確保預約系統運作順暢，改期申請須於預約時間前完成，並請於 7 天內完成使用，逾期將視為放棄該次預約資格權益喔！
                  </li>
                </ul>
              </div>

              <div className="weather-block">
                <p className="weather-head">
                  其他天氣狀況（如 3 號颱風信號、紅色暴雨警告等）
                </p>
                <ul className="weather-list">
                  <li>
                    除上述極端天氣情況外，場地服務將照常提供。所有已確認的預約，恕無法接受取消、改期或退款，感謝您的理解與配合。
                  </li>
                </ul>
              </div>
            </div>
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

              <p className="dir-address">{ADDRESS}</p>

              <ul className="dir-notes">
                <li>港鐵鑽石山站 A2 出口或啟德站 Airside C 出口步行約 8–10 分鐘</li>
                <li>距離鑽石山站 A2 出口 500 米（建議路線）</li>
                <li>亦可乘搭巴士或小巴至大有街附近下車</li>
                <li>建議泊車：新科技廣場停車場（威信停車場）</li>
              </ul>

              <div className="dir-actions">
                <a
                  className="dir-btn primary"
                  href={MAPS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MapPin size={17} strokeWidth={1.9} />
                  Google Maps 導航
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