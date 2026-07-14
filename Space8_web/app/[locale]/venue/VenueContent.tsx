"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Check, MapPin, Navigation } from "lucide-react";
import { CMSText } from "@/components/cms/CMSText";
import { getVenueAddress, getVenueMapsUrl } from "@/lib/venue";

const DARK = "#1D1D1F";
const GREEN = "#22C55E";

const FONT_FAMILY =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Helvetica, Arial, sans-serif";

const EASE = [0.16, 1, 0.3, 1] as const;
const VIEWPORT = { once: true, amount: 0.3 } as const;

const VENUE_IMAGES = [
  "/gallery/IMG_1511.jpg",
  "/gallery/IMG_1512.jpg",
  "/gallery/IMG_1513.jpg",
  "/gallery/IMG_1514.jpg",
];

export default function VenueContent({ locale }: { locale: string }) {
  const t = useTranslations("venue");
  const facilities = t.raw("facilities") as string[];
  const noticeItems = t.raw("notice_items") as string[];
  const mapsUrl = getVenueMapsUrl(locale);
  const address = getVenueAddress(locale);

  return (
    <div style={{ fontFamily: FONT_FAMILY }}>
      {/* ── Section 1 — Hero (black) ── */}
      <section
        data-nav-theme="dark"
        style={{ position: "relative", background: "#000", color: "white", padding: "clamp(140px, 20vw, 220px) 24px clamp(80px, 12vw, 140px)" }}
      >
        <div style={{ maxWidth: "760px", margin: "0 auto", textAlign: "center" }}>
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE }}
            style={{ fontSize: "clamp(48px, 9vw, 80px)", fontWeight: 700, letterSpacing: "-0.03em", margin: 0, lineHeight: 1 }}
            data-cms-key="venue.hero_title"
          >
            <CMSText k="venue.hero_title">{t("hero_title")}</CMSText>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.15 }}
            style={{ fontSize: "clamp(17px, 3vw, 20px)", color: "rgba(255,255,255,0.75)", margin: "20px 0 0" }}
            data-cms-key="venue.hero_subtitle"
          >
            <CMSText k="venue.hero_subtitle">{t("hero_subtitle")}</CMSText>
          </motion.p>
        </div>
      </section>

      {/* ── Section 2 — Facilities (white, photos + feature list) ── */}
      <section
        data-nav-theme="light"
        style={{ background: "#F5F5F7", color: DARK, padding: "clamp(80px, 12vw, 140px) 24px" }}
      >
        <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
          <motion.h2
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={VIEWPORT}
            transition={{ duration: 0.6, ease: EASE }}
            style={{ fontSize: "clamp(32px, 5vw, 48px)", fontWeight: 700, letterSpacing: "-0.02em", margin: "0 0 48px" }}
            data-cms-key="venue.facilities_title"
          >
            <CMSText k="venue.facilities_title">{t("facilities_title")}</CMSText>
          </motion.h2>

          <div
            className="no-scrollbar"
            style={{ display: "flex", gap: "16px", overflowX: "auto", scrollSnapType: "x mandatory", marginBottom: "56px", paddingBottom: "4px" }}
          >
            {VENUE_IMAGES.map((src, i) => (
              <motion.div
                key={src}
                initial={{ opacity: 0, scale: 0.97 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={VIEWPORT}
                transition={{ duration: 0.5, ease: EASE, delay: Math.min(i * 0.06, 0.3) }}
                style={{
                  position: "relative",
                  flexShrink: 0,
                  width: "min(80vw, 420px)",
                  aspectRatio: "16 / 11",
                  borderRadius: "20px",
                  overflow: "hidden",
                  scrollSnapAlign: "start",
                  background: "#E5E5E5",
                }}
              >
                <Image src={src} alt={`${t("facilities_title")} ${i + 1}`} fill sizes="(max-width: 768px) 80vw, 420px" style={{ objectFit: "cover" }} />
              </motion.div>
            ))}
          </div>

          <div style={{ display: "grid", gap: "16px 32px", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            {facilities.map((f, i) => (
              <div key={f} style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "17px", color: DARK }} data-cms-key={`venue.facility.${i}`}>
                <Check size={20} color={GREEN} strokeWidth={2.5} />
                {f}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 3 — Service description (black) ── */}
      <section
        data-nav-theme="dark"
        style={{ background: "#000", color: "white", padding: "clamp(80px, 12vw, 140px) 24px" }}
      >
        <div style={{ maxWidth: "760px", margin: "0 auto" }}>
          <motion.h2
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={VIEWPORT}
            transition={{ duration: 0.6, ease: EASE }}
            style={{ fontSize: "clamp(32px, 5vw, 48px)", fontWeight: 700, letterSpacing: "-0.02em", margin: "0 0 32px" }}
            data-cms-key="venue.service_title"
          >
            <CMSText k="venue.service_title">{t("service_title")}</CMSText>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={VIEWPORT}
            transition={{ duration: 0.6, ease: EASE, delay: 0.1 }}
            style={{ fontSize: "18px", lineHeight: 1.75, color: "rgba(255,255,255,0.75)", margin: 0 }}
            data-cms-key="venue.service_body"
          >
            <CMSText k="venue.service_body">{t("service_body")}</CMSText>
          </motion.p>
        </div>
      </section>

      {/* ── Section 4 — Things to note (dark gray) ── */}
      <section
        data-nav-theme="dark"
        style={{ background: "#1C1C1E", color: "white", padding: "clamp(80px, 12vw, 140px) 24px" }}
      >
        <div style={{ maxWidth: "760px", margin: "0 auto" }}>
          <motion.h2
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={VIEWPORT}
            transition={{ duration: 0.6, ease: EASE }}
            style={{ fontSize: "clamp(32px, 5vw, 48px)", fontWeight: 700, letterSpacing: "-0.02em", margin: "0 0 40px" }}
            data-cms-key="venue.notice_title"
          >
            <CMSText k="venue.notice_title">{t("notice_title")}</CMSText>
          </motion.h2>

          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "20px" }}>
            {noticeItems.map((item, i) => (
              <motion.li
                key={item}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={VIEWPORT}
                transition={{ duration: 0.5, ease: EASE, delay: i * 0.06 }}
                style={{ display: "flex", alignItems: "flex-start", gap: "14px", fontSize: "17px", lineHeight: 1.6, color: "rgba(255,255,255,0.8)" }}
                data-cms-key={`venue.notice.${i}`}
              >
                <span aria-hidden="true" style={{ width: "6px", height: "6px", borderRadius: "50%", background: GREEN, marginTop: "10px", flexShrink: 0 }} />
                {item}
              </motion.li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Section 5 — Directions (white, one-tap Google Maps nav) ── */}
      <section
        data-nav-theme="light"
        style={{ background: "#fff", color: DARK, padding: "clamp(80px, 12vw, 140px) 24px" }}
      >
        <div style={{ maxWidth: "760px", margin: "0 auto" }}>
          <motion.h2
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={VIEWPORT}
            transition={{ duration: 0.6, ease: EASE }}
            style={{ fontSize: "clamp(32px, 5vw, 48px)", fontWeight: 700, letterSpacing: "-0.02em", margin: "0 0 40px" }}
            data-cms-key="venue.directions_title"
          >
            <CMSText k="venue.directions_title">{t("directions_title")}</CMSText>
          </motion.h2>

          <div style={{ display: "flex", alignItems: "flex-start", gap: "16px", marginBottom: "24px" }}>
            <MapPin size={24} color={GREEN} strokeWidth={1.75} style={{ marginTop: "2px", flexShrink: 0 }} />
            <div>
              <span
                style={{ display: "block", fontSize: "13px", color: "#86868B", textTransform: "uppercase", letterSpacing: "0.04em" }}
                data-cms-key="venue.directions_address_label"
              >
                <CMSText k="venue.directions_address_label">{t("directions_address_label")}</CMSText>
              </span>
              <span style={{ display: "block", fontSize: "19px", marginTop: "4px" }} data-cms-key="footer.address">
                <CMSText k="footer.address">{address}</CMSText>
              </span>
            </div>
          </div>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={VIEWPORT}
            transition={{ duration: 0.6, ease: EASE, delay: 0.1 }}
            style={{ fontSize: "17px", lineHeight: 1.7, color: "#494951", margin: "0 0 40px" }}
            data-cms-key="venue.directions_body"
          >
            <CMSText k="venue.directions_body">{t("directions_body")}</CMSText>
          </motion.p>

          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "10px",
              background: GREEN,
              color: "#000",
              fontWeight: 700,
              fontSize: "16px",
              padding: "0 28px",
              height: "52px",
              borderRadius: "100px",
              textDecoration: "none",
            }}
            data-cms-key="venue.directions_cta"
          >
            <Navigation size={20} strokeWidth={2} />
            <CMSText k="venue.directions_cta">{t("directions_cta")}</CMSText>
          </a>
        </div>
      </section>
    </div>
  );
}
