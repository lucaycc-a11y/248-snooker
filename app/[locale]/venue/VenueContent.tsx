"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  Target,
  Lightbulb,
  Thermometer,
  Wifi,
  CupSoda,
  QrCode,
  MapPin,
  CalendarCheck,
  MessageCircle,
  BadgeCheck,
  MousePointerClick,
  CloudRain,
} from "lucide-react";

const DARK = "#1D1D1F";
const SUBTLE = "#6e6e73";
const GREEN = "#22C55E";

const FONT_FAMILY =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Helvetica, Arial, sans-serif";

const EASE = [0.16, 1, 0.3, 1] as const;
const VIEWPORT = { once: true, amount: 0.25 } as const;

const ADDRESS = "香港新蒲崗大有街 32 號泰力工業中心 3 樓 05 室";
const MAPS_URL = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
  "泰力工業中心 32 Tai Yau Street, San Po Kong, Hong Kong",
)}`;

const FACILITY_ICONS = [Target, Lightbulb, Thermometer, Wifi, CupSoda, QrCode];
const SERVICE_ICONS = [BadgeCheck, MousePointerClick, CalendarCheck, MessageCircle];

type TitledItem = { title: string; body: string };

export default function VenueContent() {
  const t = useTranslations("venuePage");
  const facilities = t.raw("facilities") as TitledItem[];
  const services = t.raw("services") as TitledItem[];
  const rules = t.raw("rules") as string[];

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: "clamp(32px, 5vw, 48px)",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    margin: "0 0 48px",
  };

  return (
    <div style={{ fontFamily: FONT_FAMILY }}>
      {/* ── Hero — black, venue image ── */}
      <section
        data-nav-theme="dark"
        style={{
          position: "relative",
          height: "72dvh",
          minHeight: "480px",
          overflow: "hidden",
          background: "#000",
        }}
      >
        {/* TODO: 需要 Luca 提供正確素材 — 中式桌球枱場地照片（暫用現有圖） */}
        <Image
          src="/gallery/IMG_1511.jpg"
          alt="Space8"
          fill
          priority
          sizes="100vw"
          style={{ objectFit: "cover", filter: "brightness(0.5)" }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            padding: "0 24px",
          }}
        >
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE }}
            style={{
              fontSize: "clamp(44px, 9vw, 84px)",
              fontWeight: 700,
              letterSpacing: "-0.03em",
              color: "white",
              margin: 0,
              lineHeight: 1.05,
            }}
          >
            {t("hero_title")}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.15 }}
            style={{
              fontSize: "clamp(17px, 3vw, 22px)",
              color: "rgba(255,255,255,0.85)",
              margin: "20px 0 0",
              maxWidth: "600px",
            }}
          >
            {t("hero_subtitle")}
          </motion.p>
        </div>
      </section>

      {/* ── Facilities — white ── */}
      <section
        data-nav-theme="light"
        style={{ background: "#fff", color: DARK, padding: "clamp(80px, 10vw, 130px) 24px" }}
      >
        <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={VIEWPORT}
            transition={{ duration: 0.6, ease: EASE }}
            style={sectionTitleStyle}
          >
            {t("facilities_title")}
          </motion.h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "20px",
            }}
          >
            {facilities.map((item, i) => {
              const Icon = FACILITY_ICONS[i] ?? Target;
              return (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={VIEWPORT}
                  transition={{ duration: 0.5, ease: EASE, delay: i * 0.06 }}
                  style={{
                    border: "1px solid #d2d2d7",
                    borderRadius: "20px",
                    padding: "32px 28px",
                  }}
                >
                  <Icon size={30} color={GREEN} strokeWidth={1.6} style={{ marginBottom: 18 }} />
                  <h3
                    style={{ fontSize: "20px", fontWeight: 600, margin: "0 0 8px" }}
                  >
                    {item.title}
                  </h3>
                  <p style={{ fontSize: "16px", color: SUBTLE, lineHeight: 1.6, margin: 0 }}>
                    {item.body}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Services — black ── */}
      <section
        data-nav-theme="dark"
        style={{ background: "#000", color: "#fff", padding: "clamp(80px, 10vw, 130px) 24px" }}
      >
        <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={VIEWPORT}
            transition={{ duration: 0.6, ease: EASE }}
            style={sectionTitleStyle}
          >
            {t("services_title")}
          </motion.h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "20px",
            }}
          >
            {services.map((item, i) => {
              const Icon = SERVICE_ICONS[i] ?? BadgeCheck;
              return (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={VIEWPORT}
                  transition={{ duration: 0.5, ease: EASE, delay: i * 0.06 }}
                  style={{
                    border: "1px solid rgba(255,255,255,0.14)",
                    borderRadius: "20px",
                    padding: "32px 28px",
                  }}
                >
                  <Icon size={30} color={GREEN} strokeWidth={1.6} style={{ marginBottom: 18 }} />
                  <h3 style={{ fontSize: "20px", fontWeight: 600, margin: "0 0 8px" }}>
                    {item.title}
                  </h3>
                  <p
                    style={{
                      fontSize: "16px",
                      color: "rgba(255,255,255,0.65)",
                      lineHeight: 1.6,
                      margin: 0,
                    }}
                  >
                    {item.body}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Rules highlights — white ── */}
      <section
        data-nav-theme="light"
        style={{ background: "#fff", color: DARK, padding: "clamp(80px, 10vw, 130px) 24px" }}
      >
        <div style={{ maxWidth: "760px", margin: "0 auto" }}>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={VIEWPORT}
            transition={{ duration: 0.6, ease: EASE }}
            style={sectionTitleStyle}
          >
            {t("rules_title")}
          </motion.h2>
          <ol style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {rules.map((rule, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, x: -16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={VIEWPORT}
                transition={{ duration: 0.45, ease: EASE, delay: i * 0.05 }}
                style={{
                  display: "flex",
                  gap: "18px",
                  alignItems: "flex-start",
                  padding: "18px 0",
                  borderBottom: "1px solid #e8e8ed",
                  fontSize: "17px",
                  lineHeight: 1.6,
                }}
              >
                <span
                  style={{
                    flexShrink: 0,
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    border: `1px solid ${GREEN}`,
                    color: GREEN,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "14px",
                    fontWeight: 600,
                    marginTop: "1px",
                  }}
                >
                  {i + 1}
                </span>
                {rule}
              </motion.li>
            ))}
          </ol>
          <div style={{ marginTop: "32px" }}>
            <Link
              href="/legal"
              style={{
                display: "inline-flex",
                alignItems: "center",
                minHeight: 44,
                fontSize: "16px",
                color: GREEN,
                textDecoration: "underline",
                textUnderlineOffset: "4px",
              }}
            >
              {t("rules_link")}
            </Link>
          </div>
        </div>
      </section>

      {/* ── Bad weather & special arrangements — black.
          Wording is kept identical to the homepage/FAQ 惡劣天氣 answer so the
          two never contradict each other (see messages/*.json faq_weather_a). ── */}
      <section
        data-nav-theme="dark"
        style={{ background: "#000", color: "#fff", padding: "clamp(80px, 10vw, 130px) 24px" }}
      >
        <div style={{ maxWidth: "760px", margin: "0 auto" }}>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={VIEWPORT}
            transition={{ duration: 0.6, ease: EASE }}
            style={sectionTitleStyle}
          >
            {t("weather_title")}
          </motion.h2>
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={VIEWPORT}
            transition={{ duration: 0.55, ease: EASE, delay: 0.1 }}
            style={{
              border: "1px solid rgba(255,255,255,0.14)",
              borderRadius: "20px",
              padding: "36px 28px",
            }}
          >
            <CloudRain size={30} color={GREEN} strokeWidth={1.6} style={{ marginBottom: 18 }} />
            <p
              style={{
                fontSize: "16px",
                color: "rgba(255,255,255,0.72)",
                lineHeight: 1.75,
                margin: 0,
                whiteSpace: "pre-line",
              }}
            >
              {t("weather_body")}
            </p>
          </motion.div>
        </div>
      </section>

      {/* ── Directions — black ── */}
      <section
        data-nav-theme="dark"
        style={{ background: "#000", color: "#fff", padding: "clamp(80px, 10vw, 130px) 24px" }}
      >
        <div style={{ maxWidth: "760px", margin: "0 auto", textAlign: "center" }}>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={VIEWPORT}
            transition={{ duration: 0.6, ease: EASE }}
            style={{ ...sectionTitleStyle, marginBottom: "32px" }}
          >
            {t("directions_title")}
          </motion.h2>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={VIEWPORT}
            transition={{ duration: 0.6, ease: EASE, delay: 0.1 }}
            style={{
              border: "1px solid rgba(255,255,255,0.14)",
              borderRadius: "20px",
              padding: "40px 28px",
            }}
          >
            <MapPin size={32} color={GREEN} strokeWidth={1.6} style={{ marginBottom: 16 }} />
            <p
              style={{ fontSize: "clamp(18px, 3vw, 22px)", fontWeight: 600, margin: "0 0 12px" }}
            >
              {t("address")}
            </p>
            <p
              style={{
                fontSize: "16px",
                color: "rgba(255,255,255,0.65)",
                lineHeight: 1.7,
                margin: "0 0 32px",
              }}
            >
              {t("directions_body")}
            </p>
            <div
              style={{
                display: "flex",
                gap: "12px",
                justifyContent: "center",
                flexWrap: "wrap",
              }}
            >
              <a
                href={MAPS_URL}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  minHeight: "48px",
                  padding: "0 28px",
                  borderRadius: "100px",
                  background: GREEN,
                  color: "#000",
                  fontSize: "16px",
                  fontWeight: 700,
                  textDecoration: "none",
                }}
              >
                <MapPin size={18} strokeWidth={2} />
                {t("map_cta")}
              </a>
              <Link
                href="/book"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  minHeight: "48px",
                  padding: "0 28px",
                  borderRadius: "100px",
                  border: "1px solid rgba(255,255,255,0.28)",
                  color: "#fff",
                  fontSize: "16px",
                  fontWeight: 500,
                  textDecoration: "none",
                }}
              >
                {t("book_cta")}
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
