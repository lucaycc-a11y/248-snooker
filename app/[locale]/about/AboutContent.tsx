"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Target, Clock, Smartphone, Check, MapPin, MessageCircle, Mail, ChevronDown } from "lucide-react";

const DARK = "#1D1D1F";
const SUBTLE = "#86868B";
const GREEN = "#22C55E";
const BORDER_DARK = "#2D2D2D";

const FONT_FAMILY =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Helvetica, Arial, sans-serif";

const EASE = [0.16, 1, 0.3, 1] as const;
const VIEWPORT = { once: true, amount: 0.3 } as const;

const WHATSAPP_URL = "https://wa.me/85264274620";
const EMAIL = "info.formhk@gmail.com";
const PHONE = "+852 6427 4620";

const VENUE_IMAGES = [
  "/gallery/IMG_1511.jpg",
  "/gallery/IMG_1512.jpg",
  "/gallery/IMG_1513.jpg",
  "/gallery/IMG_1514.jpg",
  "/gallery/IMG_1515.jpg",
];

const MISSION_ICONS = [Target, Clock, Smartphone];

type MissionItem = { title: string; body: string };
type NumberItem = { value: string; label: string };

export default function AboutContent() {
  const t = useTranslations("aboutPage");
  const missionItems = t.raw("mission_items") as MissionItem[];
  const venueFeatures = t.raw("venue_features") as string[];
  const numbers = t.raw("numbers") as NumberItem[];

  return (
    <div style={{ fontFamily: FONT_FAMILY }}>
      {/* ── Section 1 — Hero (black, full screen, venue image + overlay) ── */}
      <section
        data-nav-theme="dark"
        style={{ position: "relative", height: "100dvh", minHeight: "560px", overflow: "hidden", background: "#000" }}
      >
        <Image
          src="/video/hero-poster.jpg"
          alt="Space8"
          fill
          priority
          sizes="100vw"
          style={{ objectFit: "cover", filter: "brightness(0.55)" }}
        />
        <div
          aria-hidden="true"
          style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.2) 50%, rgba(0,0,0,0.7) 100%)" }}
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
            style={{ fontSize: "clamp(48px, 11vw, 96px)", fontWeight: 700, letterSpacing: "-0.03em", color: "white", margin: 0, lineHeight: 1 }}
            data-cms-key="about.hero_title"
          >
            {t("hero_title")}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.15 }}
            style={{ fontSize: "clamp(17px, 3vw, 22px)", color: "rgba(255,255,255,0.85)", margin: "20px 0 0", maxWidth: "600px" }}
            data-cms-key="about.hero_subtitle"
          >
            {t("hero_subtitle")}
          </motion.p>
        </div>
        {/* Scroll indicator */}
        <motion.div
          aria-hidden="true"
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          style={{ position: "absolute", bottom: "32px", left: "50%", transform: "translateX(-50%)", zIndex: 1, color: "rgba(255,255,255,0.7)" }}
        >
          <ChevronDown size={28} strokeWidth={1.5} />
        </motion.div>
      </section>

      {/* ── Section 2 — Mission (white) ── */}
      <section
        data-nav-theme="light"
        style={{ background: "#fff", color: DARK, padding: "clamp(80px, 12vw, 140px) 24px" }}
      >
        <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={VIEWPORT}
            transition={{ duration: 0.5, ease: EASE }}
            style={{ fontSize: "14px", fontWeight: 600, color: GREEN, letterSpacing: "0.04em", margin: "0 0 24px" }}
            data-cms-key="about.mission_eyebrow"
          >
            {t("mission_eyebrow")}
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={VIEWPORT}
            transition={{ duration: 0.6, ease: EASE }}
            style={{ fontSize: "clamp(30px, 5vw, 52px)", fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.15, margin: "0 0 64px", maxWidth: "820px" }}
            data-cms-key="about.mission_statement"
          >
            {t("mission_statement")}
          </motion.h2>

          <div style={{ display: "grid", gap: "40px", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
            {missionItems.map((item, i) => {
              const Icon = MISSION_ICONS[i] ?? Target;
              return (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={VIEWPORT}
                  transition={{ duration: 0.5, ease: EASE, delay: i * 0.1 }}
                >
                  <Icon size={32} color={GREEN} strokeWidth={1.5} />
                  <h3 style={{ fontSize: "20px", fontWeight: 700, margin: "20px 0 8px", color: DARK }} data-cms-key={`about.mission.${i}.title`}>
                    {item.title}
                  </h3>
                  <p style={{ fontSize: "16px", lineHeight: 1.6, color: "#494951", margin: 0 }} data-cms-key={`about.mission.${i}.body`}>
                    {item.body}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Section 3 — Story (black) ── */}
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
            data-cms-key="about.story_title"
          >
            {t("story_title")}
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={VIEWPORT}
            transition={{ duration: 0.6, ease: EASE, delay: 0.1 }}
            style={{ fontSize: "19px", lineHeight: 1.7, color: "rgba(255,255,255,0.75)", margin: 0 }}
            data-cms-key="about.story_body"
          >
            {t("story_body")}
          </motion.p>
        </div>
      </section>

      {/* ── Section 4 — Venue (white, photo gallery + features) ── */}
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
            data-cms-key="about.venue_title"
          >
            {t("venue_title")}
          </motion.h2>

          {/* Photo gallery — horizontal scroll-snap on mobile, grid on desktop */}
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
                <Image src={src} alt={`${t("venue_title")} ${i + 1}`} fill sizes="(max-width: 768px) 80vw, 420px" style={{ objectFit: "cover" }} />
              </motion.div>
            ))}
          </div>

          {/* Features */}
          <div style={{ display: "grid", gap: "16px 32px", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            {venueFeatures.map((f, i) => (
              <div key={f} style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "17px", color: DARK }} data-cms-key={`about.venue_feature.${i}`}>
                <Check size={20} color={GREEN} strokeWidth={2.5} />
                {f}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 5 — Numbers (black, big stat display) ── */}
      <section
        data-nav-theme="dark"
        style={{ background: "#000", color: "white", padding: "clamp(80px, 12vw, 140px) 24px" }}
      >
        <div
          style={{
            maxWidth: "1000px",
            margin: "0 auto",
            display: "grid",
            gap: "48px 24px",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            textAlign: "center",
          }}
        >
          {numbers.map((n, i) => (
            <motion.div
              key={n.label}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={VIEWPORT}
              transition={{ duration: 0.5, ease: EASE, delay: i * 0.08 }}
            >
              <div style={{ fontSize: "clamp(56px, 9vw, 88px)", fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1, color: GREEN }} data-cms-key={`about.number.${i}.value`}>
                {n.value}
              </div>
              <div style={{ fontSize: "15px", color: "rgba(255,255,255,0.6)", marginTop: "12px" }} data-cms-key={`about.number.${i}.label`}>
                {n.label}
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Section 6 — Contact (dark gray) ── */}
      <section
        data-nav-theme="dark"
        style={{ background: "#1C1C1E", color: "white", padding: "clamp(80px, 12vw, 140px) 24px" }}
      >
        <div style={{ maxWidth: "760px", margin: "0 auto" }}>
          <h2
            style={{ fontSize: "clamp(32px, 5vw, 48px)", fontWeight: 700, letterSpacing: "-0.02em", margin: "0 0 48px" }}
            data-cms-key="about.contact_title"
          >
            {t("contact_title")}
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: "28px", marginBottom: "48px" }}>
            <ContactRow icon={<MapPin size={22} color={GREEN} strokeWidth={1.75} />} label={t("contact_address_label")} value={t("contact_address")} cmsKey="about.contact_address" />
            <ContactRow icon={<MessageCircle size={22} color={GREEN} strokeWidth={1.75} />} label={t("contact_whatsapp_label")} value={PHONE} href={WHATSAPP_URL} cmsKey="about.contact_whatsapp" />
            <ContactRow icon={<Mail size={22} color={GREEN} strokeWidth={1.75} />} label={t("contact_email_label")} value={EMAIL} href={`mailto:${EMAIL}`} cmsKey="about.contact_email" />
            <ContactRow icon={<Clock size={22} color={GREEN} strokeWidth={1.75} />} label={t("contact_hours_label")} value={t("contact_hours")} cmsKey="about.contact_hours" />
          </div>

          <a
            href={WHATSAPP_URL}
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
            data-cms-key="about.contact_cta"
          >
            <MessageCircle size={20} strokeWidth={2} />
            {t("contact_cta")}
          </a>
        </div>
      </section>
    </div>
  );
}

function ContactRow({
  icon,
  label,
  value,
  href,
  cmsKey,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  href?: string;
  cmsKey: string;
}) {
  const content = (
    <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
      <span style={{ flexShrink: 0 }}>{icon}</span>
      <span>
        <span style={{ display: "block", fontSize: "13px", color: SUBTLE, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</span>
        <span style={{ display: "block", fontSize: "17px", color: "white", marginTop: "2px" }} data-cms-key={cmsKey}>{value}</span>
      </span>
    </div>
  );
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
      {content}
    </a>
  ) : (
    content
  );
}
