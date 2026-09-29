"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { SITE_CONTACT } from "@/lib/site/contact";
import { Clock, MapPin, MessageCircle, Mail } from "lucide-react";
import { SpaceWheelSection } from "./SpaceWheelSection";
import { SpaceWheelOutro } from "./SpaceWheelOutro";

const GREEN = "#22C55E";

const WHATSAPP_URL = SITE_CONTACT.whatsappUrl;
const EMAIL = SITE_CONTACT.email;
const PHONE = SITE_CONTACT.phone;

export default function AboutContent() {
  const t = useTranslations("aboutPage");

  return (
    <div>
      {/* ── SpaceWheel gallery + outro (replaces Sections 1, 2, 5, 6) ── */}
      <SpaceWheelSection />
      <SpaceWheelOutro />

      {/* ── Section 7: 聯絡我們 (kept unchanged) ── */}
      <section
        data-nav-theme="dark"
        style={{ background: "#1C1C1E", color: "white", padding: "clamp(80px, 12vw, 140px) 24px" }}
      >
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <h2 style={{ fontSize: "clamp(32px, 5vw, 48px)", fontWeight: 700, letterSpacing: "-0.02em", margin: "0 0 48px" }}>
            {t("contact_title")}
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 28, marginBottom: 48 }}>
            <ContactRow icon={<MapPin size={22} color={GREEN} strokeWidth={1.75} />} label={t("contact_address_label")} value={t("contact_address")} />
            <ContactRow icon={<MessageCircle size={22} color={GREEN} strokeWidth={1.75} />} label={t("contact_whatsapp_label")} value={PHONE} href={WHATSAPP_URL} />
            <ContactRow icon={<Mail size={22} color={GREEN} strokeWidth={1.75} />} label={t("contact_email_label")} value={EMAIL} href={`mailto:${EMAIL}`} />
            <ContactRow icon={<Clock size={22} color={GREEN} strokeWidth={1.75} />} label={t("contact_hours_label")} value={t("contact_hours")} />
          </div>
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex", alignItems: "center", gap: 10,
              background: GREEN, color: "#000", fontWeight: 700, fontSize: 16,
              padding: "0 28px", height: 52, borderRadius: 100, textDecoration: "none",
            }}
          >
            <MessageCircle size={20} strokeWidth={2} />
            {t("contact_cta")}
          </a>
        </div>
      </section>

      {/* ── Stars canvas ── */}
      <StarsCanvas />
    </div>
  );
}

function ContactRow({ icon, label, value, href }: { icon: React.ReactNode; label: string; value: string; href?: string }) {
  const content = (
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <span style={{ flexShrink: 0 }}>{icon}</span>
      <span>
        <span className="font-label" style={{ display: "block", fontSize: 13, color: "#A1A1A6" }}>{label}</span>
        <span style={{ display: "block", fontSize: 17, color: "white", marginTop: 2 }}>{value}</span>
      </span>
    </div>
  );
  return href ? <a href={href} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>{content}</a> : content;
}

/* ── Stars Canvas ── */
function StarsCanvas() {
  useEffect(() => {
    const canvas = document.getElementById("philStars") as HTMLCanvasElement | null;
    const section = document.getElementById("philSection");
    if (!canvas || !section) return;

    const ctx = canvas.getContext("2d")!;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let stars: { x: number; y: number; r: number; speed: number; baseAlpha: number }[] = [];
    let w = 0, h = 0, dpr = 1;
    let raf: number | null = null, visible = false, t = 0;

    const LAYERS = [
      { count: 0.00016, r: [0.35, 0.85] as [number, number], speed: 0.01, alpha: [0.25, 0.55] as [number, number] },
      { count: 0.00009, r: [0.65, 1.35] as [number, number], speed: 0.02, alpha: [0.35, 0.75] as [number, number] },
      { count: 0.00003, r: [1.05, 1.95] as [number, number], speed: 0.035, alpha: [0.55, 1.0] as [number, number] },
    ];

    function rand(a: number, b: number) { return a + Math.random() * (b - a); }

    function resize() {
      dpr = window.devicePixelRatio || 1;
      const rect = section!.getBoundingClientRect();
      w = rect.width; h = rect.height;
      canvas!.width = w * dpr; canvas!.height = h * dpr;
      canvas!.style.width = `${w}px`; canvas!.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (stars.length === 0) initStars();
    }

    function initStars() {
      stars = [];
      const area = w * h;
      LAYERS.forEach((layer) => {
        const count = Math.round(area * layer.count);
        for (let i = 0; i < count; i++) {
          stars.push({
            x: rand(0, w), y: rand(0, h), r: rand(layer.r[0], layer.r[1]),
            speed: layer.speed, baseAlpha: rand(layer.alpha[0], layer.alpha[1]),
          });
        }
      });
    }

    function draw() {
      if (!visible) return;
      ctx.clearRect(0, 0, w, h);
      if (reduce) {
        stars.forEach((s) => {
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,255,255,${s.baseAlpha * 0.5})`;
          ctx.fill();
        });
        return;
      }
      t += 0.016;
      stars.forEach((s) => {
        const twinkle = 0.5 + 0.5 * Math.sin(t * s.speed * 8 + s.x);
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${s.baseAlpha * twinkle})`;
        ctx.fill();
      });
      raf = requestAnimationFrame(draw);
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          visible = e.isIntersecting;
          if (visible) draw();
          else if (raf) { cancelAnimationFrame(raf); raf = null; }
        });
      },
      { threshold: 0.1 }
    );

    resize();
    io.observe(section);
    window.addEventListener("resize", resize);
    return () => {
      io.disconnect();
      window.removeEventListener("resize", resize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
  return null;
}