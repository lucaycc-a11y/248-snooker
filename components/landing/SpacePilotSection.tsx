"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import {
  BadgeCheck,
  Bot,
  Clock3,
  Languages,
  Monitor,
  QrCode,
  Sparkles,
  Trophy,
  UserPlus,
  Users,
  VolumeX,
} from "lucide-react";

const ICONS = [
  QrCode,
  Bot,
  Trophy,
  BadgeCheck,
  UserPlus,
  Monitor,
  Clock3,
  VolumeX,
  Languages,
  Users,
] as const;

const EASE = [0.2, 0.7, 0.3, 1] as const;

type SpacePilotSectionProps = {
  limit?: number;
  compact?: boolean;
};

export default function SpacePilotSection({ limit, compact = false }: SpacePilotSectionProps) {
  const t = useTranslations("spacePilot");
  const count = limit ?? ICONS.length;
  const features = Array.from({ length: count }, (_, index) => ({
    Icon: ICONS[index],
    title: t(`features.${index}.title`),
    body: t(`features.${index}.body`),
  }));

  return (
    <section
      aria-labelledby="space-pilot-title"
      data-nav-theme="dark"
      style={{ background: "#000", color: "#fff", padding: compact ? "88px 20px" : "120px 20px 132px" }}
    >
      <div style={{ maxWidth: 1120, margin: "0 auto" }}>
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.7, ease: EASE }}
          style={{ maxWidth: 700, marginBottom: compact ? 34 : 52 }}
        >
          <p
            data-cms-key="spacePilot.eyebrow"
            className="font-label"
            style={{ color: "#22C55E", fontSize: 12, margin: "0 0 14px" }}
          >
            {t("eyebrow")}
          </p>
          <h2 id="space-pilot-title" data-cms-key="spacePilot.title" style={{ fontSize: "clamp(2rem, 5vw, 4rem)", lineHeight: 1.08, letterSpacing: "-0.04em", margin: 0 }}>
            {t("title")}
          </h2>
          <p data-cms-key="spacePilot.intro" style={{ color: "rgba(255,255,255,0.62)", fontSize: "clamp(15px, 2vw, 18px)", lineHeight: 1.7, margin: "20px 0 0", maxWidth: "58ch" }}>
            {t("intro")}
          </p>
        </motion.div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 250px), 1fr))", gap: 12 }}>
          {features.map(({ Icon, title, body }, index) => (
            <motion.article
              key={title}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.15 }}
              transition={{ duration: 0.65, delay: index * 0.035, ease: EASE }}
              style={{ border: "1px solid #2D2D2D", borderRadius: 18, padding: compact ? "22px 20px" : "26px 24px", minHeight: compact ? 0 : 190 }}
            >
              <Icon aria-hidden="true" size={25} strokeWidth={1.5} style={{ color: "#22C55E", marginBottom: 20 }} />
              <h3 data-cms-key={`spacePilot.features.${index}.title`} style={{ fontSize: 17, lineHeight: 1.4, margin: "0 0 9px" }}>{title}</h3>
              <p data-cms-key={`spacePilot.features.${index}.body`} style={{ color: "rgba(255,255,255,0.58)", fontSize: 14, lineHeight: 1.7, margin: 0 }}>{body}</p>
            </motion.article>
          ))}
        </div>

        {compact && (
          <p data-cms-key="spacePilot.more" style={{ color: "#22C55E", fontSize: 14, margin: "28px 0 0" }}>
            <Sparkles aria-hidden="true" size={15} style={{ verticalAlign: "-3px", marginRight: 7 }} />
            {t("more")}
          </p>
        )}
      </div>
    </section>
  );
}
