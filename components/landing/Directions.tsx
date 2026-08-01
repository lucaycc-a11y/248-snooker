"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

const FONT_FAMILY =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Noto Sans TC', 'Helvetica Neue', Helvetica, Arial, sans-serif";

const ADDRESS = "香港新蒲崗大有街 32 號泰力工業中心 3 樓 05 室";
const MAPS_URL = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
  "泰力工業中心 32 Tai Yau Street, San Po Kong, Hong Kong",
)}`;
const EMBED_URL = "https://maps.google.com/maps?q=%E9%A6%99%E6%B8%AF%E6%96%B0%E8%92%B2%E5%B4%97%E5%A4%A7%E6%9C%89%E8%A1%9732%E8%99%9F%E6%B3%B0%E5%8A%9B%E5%B7%A5%E6%A5%AD%E4%B8%AD%E5%BF%83&t=&z=17&ie=UTF8&iwloc=&output=embed";

export default function Directions() {
  const t = useTranslations("venuePage");
  const secRef = useRef<HTMLElement>(null);
  const [isIn, setIsIn] = useState(false);

  useEffect(() => {
    const el = secRef.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
        !("IntersectionObserver" in window)) { setIsIn(true); return; }
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        setIsIn(true);
        obs.unobserve(e.target);
      });
    }, { threshold: 0.15, rootMargin: "0px 0px -6% 0px" });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section
      ref={secRef}
      className={`dir-section ${isIn ? "is-in" : ""}`}
      data-nav-theme="light"
      style={{
        background: "#ffffff",
        padding: "120px 24px 140px",
      }}
    >
      <div className="dir-inner" style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div className="dir-layout" style={{
          display: "grid",
          gridTemplateColumns: "1fr 0.85fr",
          gap: 34,
          alignItems: "stretch",
        }}>
          {/* Left: info card */}
          <div className="dir-card" style={{
            background: "#ffffff",
            border: "1px solid rgba(17,17,16,0.14)",
            borderRadius: 20,
            padding: "42px 40px 44px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            boxShadow: "0 1px 2px rgba(17,17,16,0.04)",
            opacity: 0,
            transform: "translateY(20px) scale(0.96)",
            transition: "opacity .55s cubic-bezier(.34,1.56,.64,1), transform .55s cubic-bezier(.34,1.56,.64,1)",
          }}>
            <div className="dir-header" style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              marginBottom: 28,
            }}>
              <div className="dir-pin" style={{
                flexShrink: 0,
                width: 38,
                height: 38,
                color: "#1a9d5c",
              }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: "100%", height: "100%", display: "block" }}>
                  <path className="pi-pin-body" d="M20 10.5c0 5.4-8 12-8 12s-8-6.6-8-12a8 8 0 0 1 16 0z" />
                  <circle className="pi-pin-dot" cx="12" cy="10.3" r="3" />
                </svg>
              </div>
              <h2 className="dir-title" style={{
                fontFamily: FONT_FAMILY,
                fontWeight: 900,
                fontSize: "clamp(1.4rem, 2.8vw, 1.95rem)",
                color: "#111110",
                lineHeight: 1.2,
              }}>
                {t("directions_title")}
              </h2>
            </div>

            <p className="dir-address" style={{
              fontFamily: FONT_FAMILY,
              fontWeight: 700,
              fontSize: "clamp(16px, 1.9vw, 19px)",
              lineHeight: 1.6,
              color: "#111110",
              marginBottom: 14,
            }}>
              {t("address")}
            </p>

            <ul className="dir-notes" style={{
              listStyle: "none",
              marginBottom: 30,
              padding: 0,
            }}>
              <li style={{
                position: "relative",
                paddingLeft: 17,
                fontFamily: FONT_FAMILY,
                fontSize: 13.8,
                lineHeight: 1.75,
                color: "rgba(17,17,16,0.58)",
              }}>
                港鐵鑽石山站 A2 出口或啟德站 Airside C 出口步行約 8–10 分鐘
              </li>
              <li style={{
                position: "relative",
                paddingLeft: 17,
                fontFamily: FONT_FAMILY,
                fontSize: 13.8,
                lineHeight: 1.75,
                color: "rgba(17,17,16,0.58)",
                marginTop: 8,
              }}>
                距離鑽石山站 A2 出口 500 米（建議路線）
              </li>
              <li style={{
                position: "relative",
                paddingLeft: 17,
                fontFamily: FONT_FAMILY,
                fontSize: 13.8,
                lineHeight: 1.75,
                color: "rgba(17,17,16,0.58)",
                marginTop: 8,
              }}>
                亦可乘搭巴士或小巴至大有街附近下車
              </li>
              <li style={{
                position: "relative",
                paddingLeft: 17,
                fontFamily: FONT_FAMILY,
                fontSize: 13.8,
                lineHeight: 1.75,
                color: "rgba(17,17,16,0.58)",
                marginTop: 8,
              }}>
                建議泊車：新科技廣場停車場（威信停車場）
              </li>
            </ul>

            <div className="dir-actions" style={{
              display: "flex",
              gap: 14,
              flexWrap: "wrap",
            }}>
              <a
                className="pbtn-primary dir-btn primary"
                href={MAPS_URL}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 9,
                  fontFamily: FONT_FAMILY,
                  fontSize: 14.5,
                  fontWeight: 500,
                  padding: "14px 26px",
                  borderRadius: 999,
                  textDecoration: "none",
                  cursor: "pointer",
                  background: "linear-gradient(180deg,#22b86b,#1a9d5c)",
                  color: "#ffffff",
                  boxShadow: "0 8px 26px -10px rgba(26,157,92,0.55)",
                }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ width: 17, height: 17, flexShrink: 0 }}>
                  <path d="M20 10.5c0 5.4-8 12-8 12s-8-6.6-8-12a8 8 0 0 1 16 0z" />
                  <circle cx="12" cy="10.3" r="3" />
                </svg>
                {t("map_cta")}
              </a>
              <Link
                href="/book"
                className="pbtn-ghost dir-btn ghost"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 9,
                  fontFamily: FONT_FAMILY,
                  fontSize: 14.5,
                  fontWeight: 500,
                  padding: "14px 26px",
                  borderRadius: 999,
                  textDecoration: "none",
                  cursor: "pointer",
                  background: "transparent",
                  color: "#111110",
                  border: "1px solid rgba(17,17,16,0.22)",
                }}
              >
                立即預訂
              </Link>
            </div>
          </div>

          {/* Right: map */}
          <div className="dir-map" style={{
            position: "relative",
            border: "1px solid rgba(17,17,16,0.14)",
            borderRadius: 20,
            overflow: "hidden",
            background: "#eceae5",
            minHeight: 380,
            opacity: 0,
            transform: "translateY(20px) scale(0.96)",
            transition: "opacity .55s cubic-bezier(.34,1.56,.64,1) .15s, transform .55s cubic-bezier(.34,1.56,.64,1) .15s",
          }}>
            <iframe
              src={EMBED_URL}
              title="泰力工業中心位置地圖"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                border: 0,
                display: "block",
              }}
            />
          </div>
        </div>
      </div>

      <style>{`
        .dir-section.is-in .dir-card { opacity: 1 !important; transform: none !important; }
        .dir-section.is-in .dir-map { opacity: 1 !important; transform: none !important; }

        .dir-notes li::before {
          content: "";
          position: absolute;
          left: 1px;
          top: 0.72em;
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #1a9d5c;
        }

        /* Pin icon animation: body pulses, dot bounces */
        .pi-pin-body { transform-box: fill-box; transform-origin: center;
          animation: pinBreathe 3s ease-in-out infinite; }
        .pi-pin-dot { transform-box: fill-box; transform-origin: center;
          animation: pinBounce 2.4s ease-in-out infinite; }
        @keyframes pinBreathe {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.06); }
        }
        @keyframes pinBounce {
          0%, 100% { transform: translateY(0); }
          40% { transform: translateY(-2px); }
          60% { transform: translateY(0.5px); }
        }

        @media (max-width: 880px) {
          .dir-layout { grid-template-columns: 1fr !important; gap: 24px !important; }
          .dir-card { padding: 34px 28px 36px !important; }
          .dir-map { aspect-ratio: 4 / 3; min-height: 0 !important; }
        }
        @media (max-width: 560px) {
          .dir-section { padding: 80px 24px 96px !important; }
          .dir-card { padding: 24px !important; border-radius: 18px !important; }
          .dir-header { gap: 12px !important; margin-bottom: 20px !important; }
          .dir-pin { width: 30px !important; height: 30px !important; }
          .dir-map { border-radius: 16px !important; }
          .dir-actions { gap: 10px !important; flex-direction: column !important; }
          .dir-btn { padding: 13px 20px !important; font-size: 13.5px !important; width: 100% !important; justify-content: center !important; min-height: 48px !important; }
          .dir-notes { margin-bottom: 24px !important; }
        }
        @media (prefers-reduced-motion: reduce) {
          .dir-card, .dir-map { opacity: 1 !important; transform: none !important; }
          .pi-pin-body, .pi-pin-dot { animation: none !important; }
        }
      `}</style>
    </section>
  );
}