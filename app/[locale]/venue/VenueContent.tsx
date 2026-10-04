"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { CloudRain, Calendar, Wind, Focus } from "lucide-react";
import CinematicOrbitHero from "@/components/ui/cinematic-orbit-hero";
import { RoomViewer } from "@/components/ui/RoomViewer";
import { ThreePoints } from "@/components/ui/ThreePoints";
import HowToGo from "@/components/landing/HowToGo";
import { AppleButton } from "@/components/ui/AppleButton";
import { tokens } from "@/app/styles/tokens";

const EASE = [0.16, 1, 0.3, 1] as const;
const VIEWPORT = { once: true, amount: 0.25 } as const;

export default function VenueContent() {
  const t = useTranslations("venuePage");
  const tVenue = useTranslations("venue");
  const tButton = useTranslations("ui.button");
  const tPricing = useTranslations("pricingPage");

  const [periods, setPeriods] = useState<any[]>([]);

  // Fetch pricing from config
  useEffect(() => {
    const fetchPricing = async () => {
      try {
        const res = await fetch("/api/pricing");
        if (res.ok) {
          const data = await res.json();

          // Transform API response to match component expectations
          const transformed = data.periods.map((period: any) => ({
            id: period.id,
            name: tPricing(`period_${period.id}_title`),
            time_label: tPricing(`period_${period.id}_time`),
            hourly_rate: period.rate,
            accent_color: tokens.colors.green[600],
          }));

          setPeriods(transformed);
        }
      } catch (err) {
        console.error("Failed to fetch pricing:", err);
      }
    };
    fetchPricing();
  }, [tPricing]);

  // Service instructions data
  const serviceSteps = [
    {
      step: "STEP 01",
      title: t("service_step_01_title"),
      desc: t("service_step_01_desc"),
    },
    {
      step: "STEP 02",
      title: t("service_step_02_title"),
      desc: t("service_step_02_desc"),
    },
    {
      step: "STEP 03",
      title: t("service_step_03_title"),
      desc: t("service_step_03_desc"),
    },
    {
      step: "客戶支援",
      title: t("service_support_title"),
      desc: t("service_support_desc"),
    },
  ];

  // Notes data
  const notes = [
    t("notes_item_01"),
    t("notes_item_02"),
    t("notes_item_03"),
    t("notes_item_04"),
    t("notes_item_05"),
    t("notes_item_06"),
  ];

  // Why Us items for ThreePoints with icons
  const whyUsItems = [
    {
      before: "網上預訂，",
      accent: "自助入場",
      after: "。",
      icon: <Calendar size={48} strokeWidth={1.5} />,
    },
    {
      before: "",
      accent: "全面禁煙",
      after: "，定期清潔。",
      icon: <Wind size={48} strokeWidth={1.5} />,
    },
    {
      before: "",
      accent: "零打擾，全專註",
      after: "。",
      icon: <Focus size={48} strokeWidth={1.5} />,
    },
  ];

  return (
    <div>
      <style>{`
        .service-section {
          background: #ffffff;
          padding: 120px 24px;
        }
        .service-inner {
          max-width: 1200px;
          margin: 0 auto;
        }
        .service-title {
          font-family: 'Noto Sans TC', sans-serif;
          font-weight: 900;
          font-size: clamp(1.7rem, 3.4vw, 2.4rem);
          color: #1d1d1f;
          margin-bottom: 56px;
          letter-spacing: -0.02em;
          text-align: center;
        }
        .service-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 28px;
        }
        .service-card {
          background: #ffffff;
          border: 1px solid rgba(0,0,0,0.08);
          border-radius: 20px;
          padding: 40px 32px;
          transition: border-color 0.3s ease;
        }
        .service-card:hover {
          border-color: rgba(0,0,0,0.14);
        }
        .service-step {
          display: inline-block;
          font-family: system-ui, -apple-system, SF Pro Text, sans-serif;
          font-size: 12px;
          font-weight: 600;
          color: #16a34a;
          background: rgba(22,163,74,0.1);
          padding: 4px 10px;
          border-radius: 999px;
          margin-bottom: 16px;
        }
        .service-card h3 {
          font-family: 'Noto Sans TC', sans-serif;
          font-weight: 700;
          font-size: 18px;
          color: #1d1d1f;
          margin: 0 0 12px;
          letter-spacing: -0.01em;
        }
        .service-card p {
          font-size: 15px;
          line-height: 1.6;
          color: rgba(29,29,31,0.64);
          margin: 0;
        }

        @media (max-width: 900px) {
          .service-grid { grid-template-columns: 1fr; gap: 24px; }
        }
        @media (max-width: 560px) {
          .service-section { padding: 80px 24px; }
          .service-title { margin-bottom: 40px; }
          .service-card { padding: 32px 28px; }
        }

        .notes-section {
          background: #f5f5f7;
          padding: 120px 24px;
        }
        .notes-inner { max-width: 1000px; margin: 0 auto; }
        .notes-title {
          font-family: 'Noto Sans TC', sans-serif;
          font-weight: 900;
          font-size: clamp(1.7rem, 3.4vw, 2.4rem);
          color: #1d1d1f;
          margin-bottom: 48px;
        }
        .notes-list { list-style: none; border-top: 1px solid rgba(29,29,31,0.10); margin: 0; padding: 0; }
        .notes-list li {
          display: flex;
          align-items: flex-start;
          gap: 18px;
          padding: 22px 4px;
          border-bottom: 1px solid rgba(29,29,31,0.10);
        }
        .notes-num {
          flex-shrink: 0;
          width: 26px; height: 26px;
          border-radius: 50%;
          border: 1px solid rgba(22,163,74,0.3);
          color: #16a34a;
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
          color: #1d1d1f;
          margin: 0;
        }
        .notes-link {
          display: inline-block;
          margin-top: 34px;
          font-family: 'Noto Sans TC', sans-serif;
          font-size: 14.5px;
          color: #16a34a;
          text-decoration: underline;
          text-underline-offset: 4px;
          text-decoration-thickness: 1px;
          transition: color .3s ease;
        }
        .notes-link:hover { color: #15803d; }

        .weather-section .notes-link {
          color: #22c55e;
        }
        .weather-section .notes-link:hover { color: #4ade80; }

        @media (max-width: 560px) {
          .notes-section { padding: 80px 24px; }
          .notes-title { margin-bottom: 32px; }
          .notes-list li { gap: 14px; padding: 16px 2px; }
          .notes-list p { font-size: 14px; }
        }

        .weather-section {
          background: #14161A;
          padding: 120px 24px;
        }
        .weather-inner { max-width: 1000px; margin: 0 auto; }
        .weather-card {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 20px;
          padding: 46px 44px 48px;
        }
        .weather-header {
          display: flex;
          align-items: center;
          gap: 18px;
          margin-bottom: 32px;
        }
        .weather-icon { flex-shrink: 0; width: 52px; height: 52px; color: #16a34a; }
        .weather-icon svg { width: 100%; height: 100%; display: block; }
        .weather-title {
          font-family: 'Noto Sans TC', sans-serif;
          font-weight: 900;
          font-size: clamp(1.4rem, 2.8vw, 1.95rem);
          color: #ffffff;
          line-height: 1.2;
          margin: 0;
        }
        .weather-block + .weather-block { margin-top: 34px; }
        .weather-head {
          font-family: 'Noto Sans TC', sans-serif;
          font-weight: 700;
          font-size: 15.5px;
          color: #ffffff;
          margin: 0 0 14px;
        }
        .weather-list { list-style: none; margin: 0; padding: 0; }
        .weather-list li {
          position: relative;
          padding-left: 20px;
          font-family: 'Noto Sans TC', sans-serif;
          font-size: 14.5px;
          line-height: 1.9;
          color: rgba(255,255,255,0.62);
        }
        .weather-list li + li { margin-top: 10px; }
        .weather-list li::before {
          content: "";
          position: absolute;
          left: 2px;
          top: 0.82em;
          width: 5px; height: 5px;
          border-radius: 50%;
          background: #16a34a;
        }
        .weather-list li b { color: #ffffff; font-weight: 700; }

        @media (max-width: 560px) {
          .weather-section { padding: 80px 24px; }
          .weather-card { padding: 32px 24px 34px; border-radius: 16px; }
          .weather-header { gap: 13px; margin-bottom: 26px; }
          .weather-icon { width: 38px; height: 38px; }
          .weather-list li { font-size: 13.5px; padding-left: 17px; }
        }
      `}</style>

      {/* ── 01: Hero ── */}
      <CinematicOrbitHero />

      {/* ── 02: Room Viewer (dark) ── */}
      <RoomViewer />

      {/* ── 03: Why Us (light with sheet overlap) ── */}
      <div
        style={{
          position: "relative",
          marginTop: "-48px",
          zIndex: 2,
        }}
      >
        <ThreePoints
          heading={tVenue("whyUs.heading")}
          items={whyUsItems}
          theme="light"
          accentColor={tokens.colors.green[600]}
        />
      </div>

      {/* ── 04: Pricing (dark) ── */}
      {periods && periods.length > 0 && (
        <section style={{ background: tokens.colors.bg, padding: "120px 24px" }}>
          <div style={{ maxWidth: 1040, marginInline: "auto" }}>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={VIEWPORT}
              transition={{ duration: 0.6, ease: EASE }}
              style={{
                fontFamily: "'Noto Sans TC', sans-serif",
                fontWeight: 900,
                fontSize: "clamp(1.7rem, 3.4vw, 2.4rem)",
                color: tokens.colors.text,
                marginBottom: 16,
                textAlign: "center",
              }}
            >
              {t("pricing_heading")}
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={VIEWPORT}
              transition={{ duration: 0.6, ease: EASE, delay: 0.1 }}
              style={{
                fontFamily: "'Noto Sans TC', sans-serif",
                fontSize: "clamp(1rem, 2vw, 1.125rem)",
                color: tokens.colors.textMuted,
                textAlign: "center",
                marginBottom: 56,
              }}
            >
              {t("pricing_subheading")}
            </motion.p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: 24,
              }}
            >
              {periods.map((period: any, index: number) => (
                <motion.div
                  key={period.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={VIEWPORT}
                  transition={{
                    duration: 0.5,
                    ease: EASE,
                    delay: 0.1 * index,
                  }}
                  style={{
                    background: tokens.colors.surface,
                    border: `1px solid ${tokens.colors.border}`,
                    borderRadius: 20,
                    padding: "32px 28px",
                  }}
                >
                  <p
                    style={{
                      fontFamily: "system-ui, -apple-system, SF Pro Text, sans-serif",
                      fontSize: 14,
                      fontWeight: 600,
                      color: tokens.colors.textMuted,
                      marginBottom: 8,
                    }}
                  >
                    {period.time_label}
                  </p>
                  <h3
                    style={{
                      fontFamily: "'Noto Sans TC', sans-serif",
                      fontSize: 22,
                      fontWeight: 700,
                      color: tokens.colors.text,
                      marginBottom: 20,
                    }}
                  >
                    {period.name}
                  </h3>
                  <div style={{ marginBottom: 20 }}>
                    <span
                      style={{
                        fontFamily: tokens.font.display,
                        fontSize: 40,
                        fontWeight: 700,
                        color: tokens.colors.text,
                      }}
                    >
                      HK${period.hourly_rate}
                    </span>
                    <span
                      style={{
                        fontFamily: "'Noto Sans TC', sans-serif",
                        fontSize: 14,
                        color: tokens.colors.textMuted,
                        marginLeft: 6,
                      }}
                    >
                      / 小時
                    </span>
                  </div>
                  <AppleButton
                    variant="primary"
                    size="md"
                    theme="dark"
                    accent={period.accent_color}
                    href="/book"
                  >
                    {tButton("book_now")}
                  </AppleButton>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── 05: 服務說明 (light) ── */}
      <section className="service-section" data-nav-theme="light">
        <div className="service-inner">
          <h2 className="service-title">{t("service_title")}</h2>
          <div className="service-grid">
            {serviceSteps.map((step, i) => (
              <div key={i} className="service-card">
                <span className="service-step">{step.step}</span>
                <h3>{step.title}</h3>
                <p>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 06: 留意事項 (light) ── */}
      <section className="notes-section" data-nav-theme="light">
        <div className="notes-inner">
          <h2 className="notes-title">{t("notes_title")}</h2>
          <ul className="notes-list">
            {notes.map((note, i) => (
              <li key={i}>
                <span className="notes-num">{i + 1}</span>
                <p>{note}</p>
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

      {/* ── 07: 惡劣天氣 (dark) ── */}
      <section className="weather-section" data-nav-theme="dark">
        <div className="weather-inner">
          <div className="weather-card">
            <div className="weather-header">
              <div className="weather-icon">
                <CloudRain size={52} strokeWidth={1.7} />
              </div>
              <h2 className="weather-title">{t("weather_title")}</h2>
            </div>

            <div className="weather-body">
              <div className="weather-block">
                <p className="weather-head">{t("weather_severe_title")}</p>
                <ul className="weather-list">
                  <li>{t("weather_severe_point_1")}</li>
                  <li>{t("weather_severe_point_2")}</li>
                  <li>{t("weather_severe_point_3")}</li>
                </ul>
              </div>

              <div className="weather-block">
                <p className="weather-head">{t("weather_normal_title")}</p>
                <ul className="weather-list">
                  <li>{t("weather_normal_point_1")}</li>
                </ul>
              </div>
            </div>
            <a
              className="notes-link"
              href="https://space8.com.hk/legal"
              target="_blank"
              rel="noopener noreferrer"
              style={{ marginTop: 28, display: "inline-block", color: "#16a34a" }}
            >
              {t("rules_link")}
            </a>
          </div>
        </div>
      </section>

      {/* ── 08: 如何前往 (light with HowToGo) ── */}
      <HowToGo
        theme="light"
        map={{
          embedUrl: `https://maps.google.com/maps?q=${encodeURIComponent("香港新蒲崗大有街32號泰力工業中心")}&t=&z=17&ie=UTF8&iwloc=&output=embed`,
        }}
      />
    </div>
  );
}
