"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { MapPin } from "lucide-react";

// Apple Mac footer palette
const BG = "#F5F5F7";
const TEXT = "#6E6E73";
const TEXT_DARK = "#1D1D1F";
const BORDER = "#D2D2D7";

type Lang = "zh" | "en";

interface FooterLink {
  cmsKey: string;
  href: string;
  label: Record<Lang, string>;
}

interface FooterColumn {
  cmsKey: string;
  title: Record<Lang, string>;
  links: FooterLink[];
}

const COLUMNS: FooterColumn[] = [
  {
    cmsKey: "footer.col.nav",
    title: { zh: "導覽", en: "Navigation" },
    links: [
      { cmsKey: "footer.link.book", href: "/book", label: { zh: "預訂", en: "Book" } },
      { cmsKey: "footer.link.pricing", href: "/pricing", label: { zh: "定價", en: "Pricing" } },
      { cmsKey: "footer.link.about", href: "/about", label: { zh: "關於", en: "About" } },
      { cmsKey: "footer.link.blog", href: "/blog", label: { zh: "網誌", en: "Blog" } },
    ],
  },
  {
    cmsKey: "footer.col.support",
    title: { zh: "支援", en: "Support" },
    links: [
      { cmsKey: "footer.link.faq", href: "/faq", label: { zh: "常見問題", en: "FAQ" } },
      { cmsKey: "footer.link.contact", href: "/contact", label: { zh: "聯絡我們", en: "Contact Us" } },
    ],
  },
  {
    cmsKey: "footer.col.legal",
    title: { zh: "法律", en: "Legal" },
    links: [
      { cmsKey: "footer.link.privacy", href: "/privacy", label: { zh: "私隱政策", en: "Privacy Policy" } },
      { cmsKey: "footer.link.terms", href: "/terms", label: { zh: "使用條款", en: "Terms of Use" } },
      { cmsKey: "footer.link.notice", href: "/legal", label: { zh: "法律聲明", en: "Legal Notice" } },
    ],
  },
];

const TAGLINE: Record<Lang, string> = {
  zh: "「香港 24 小時自助桌球。」",
  en: "“Hong Kong's 24-hour self-service snooker.”",
};

const COPYRIGHT = "Copyright © 2025 248 Snooker Club. All rights reserved.";
const REGION = "Hong Kong";
const LANG_LABEL: Record<Lang, string> = { zh: "繁體中文", en: "English" };

const linkBase: React.CSSProperties = {
  fontSize: "12px",
  color: TEXT,
  lineHeight: 1.8,
  display: "inline-block",
  transition: "color 0.2s ease",
};

function FooterLinkItem({ link, lang }: { link: FooterLink; lang: Lang }) {
  const [hover, setHover] = useState(false);
  return (
    <Link
      href={link.href}
      data-cms-key={link.cmsKey}
      style={{ ...linkBase, color: hover ? TEXT_DARK : TEXT }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {link.label[lang]}
    </Link>
  );
}

export default function Footer() {
  const [lang, setLang] = useState<Lang>("zh");
  const [openCol, setOpenCol] = useState<string | null>(null);

  // Restore stored preference, else auto-detect from the browser.
  useEffect(() => {
    const stored = localStorage.getItem("lang");
    if (stored === "zh" || stored === "en") {
      setLang(stored);
      return;
    }
    const detected = navigator.language?.toLowerCase().startsWith("zh") ? "zh" : "en";
    setLang(detected);
  }, []);

  const toggleLang = () => {
    setLang((prev) => {
      const next: Lang = prev === "zh" ? "en" : "zh";
      localStorage.setItem("lang", next);
      return next;
    });
  };

  const toggleCol = (key: string) => {
    setOpenCol((prev) => (prev === key ? null : key));
  };

  return (
    <footer
      style={{
        background: BG,
        borderTop: `1px solid ${BORDER}`,
        color: TEXT,
      }}
    >
      <div
        style={{
          maxWidth: "1024px",
          margin: "0 auto",
          padding: "40px 22px 24px",
        }}
      >
        {/* Logo */}
        <Link
          href="/"
          aria-label="248 Snooker Club"
          className="inline-flex"
          style={{ marginBottom: "20px" }}
        >
          <Image
            src="/1.svg"
            alt="248 Snooker Club"
            width={96}
            height={32}
            data-cms-key="footer.logo"
            className="h-8 w-auto"
            style={{ filter: "invert(1)" }}
          />
        </Link>

        {/* Tagline */}
        <p
          data-cms-key="footer.tagline"
          style={{
            color: TEXT_DARK,
            fontSize: "14px",
            margin: 0,
            marginBottom: "28px",
          }}
        >
          {TAGLINE[lang]}
        </p>

        {/* Location card header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            maxWidth: "600px",
            margin: "0 auto 12px",
          }}
        >
          <MapPin size={16} color="#22C55E" />
          <span
            data-cms-key="footer.map.name"
            style={{ fontSize: "14px", color: TEXT_DARK, fontWeight: 600 }}
          >
            248 桌球會
          </span>
          <span data-cms-key="footer.map.area" style={{ fontSize: "14px", color: TEXT }}>
            · 啟德
          </span>
          <a
            href="https://maps.app.goo.gl/vyTWerhVjByieGDQ8"
            target="_blank"
            rel="noopener noreferrer"
            data-cms-key="footer.map.link"
            style={{ marginLeft: "auto", fontSize: "13px", color: "#0071E3" }}
          >
            在地圖中開啟 ›
          </a>
        </div>

        {/* Google Map — Apple-style card. AIRSIDE, 啟德協調道 2 號 B1-31, 九龍城. */}
        <div
          style={{
            maxWidth: "600px",
            height: "240px",
            margin: "0 auto",
            borderRadius: "16px",
            overflow: "hidden",
            border: `1px solid ${BORDER}`,
            boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
            marginBottom: "48px",
          }}
        >
          <iframe
            title="248 Snooker Club — AIRSIDE 啟德協調道 2 號"
            data-cms-key="footer.map"
            src="https://maps.google.com/maps?q=AIRSIDE%20%E5%95%9F%E5%BE%B7%E5%8D%94%E8%AA%BF%E9%81%93%202%E8%99%9F&t=m&z=16&output=embed&hl=zh-HK"
            width="100%"
            height="240"
            style={{ border: 0, display: "block", filter: "grayscale(20%)" }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>

        {/* ===== Desktop: multi-column ===== */}
        <div
          className="hidden md:grid"
          style={{
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: "32px",
            paddingBottom: "24px",
          }}
        >
          {COLUMNS.map((col) => (
            <div key={col.cmsKey}>
              <h3
                data-cms-key={`${col.cmsKey}.title`}
                style={{
                  color: TEXT_DARK,
                  fontSize: "12px",
                  fontWeight: 600,
                  margin: 0,
                  marginBottom: "10px",
                }}
              >
                {col.title[lang]}
              </h3>
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {col.links.map((link) => (
                  <li key={link.cmsKey}>
                    <FooterLinkItem link={link} lang={lang} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* ===== Mobile: accordion ===== */}
        <div className="md:hidden">
          {COLUMNS.map((col) => {
            const isOpen = openCol === col.cmsKey;
            return (
              <div key={col.cmsKey} style={{ borderBottom: `1px solid ${BORDER}` }}>
                <button
                  type="button"
                  onClick={() => toggleCol(col.cmsKey)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between"
                  style={{
                    background: "transparent",
                    border: "none",
                    padding: "14px 0",
                    cursor: "pointer",
                  }}
                >
                  <span
                    data-cms-key={`${col.cmsKey}.title`}
                    style={{ color: TEXT_DARK, fontSize: "14px", fontWeight: 500 }}
                  >
                    {col.title[lang]}
                  </span>
                  <motion.span
                    animate={{ rotate: isOpen ? 90 : 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    aria-hidden="true"
                    style={{ color: TEXT, fontSize: "18px", lineHeight: 1, display: "inline-flex" }}
                  >
                    ›
                  </motion.span>
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      key="content"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                      style={{ overflow: "hidden" }}
                    >
                      <ul
                        style={{
                          listStyle: "none",
                          margin: 0,
                          padding: "0 0 14px",
                        }}
                      >
                        {col.links.map((link) => (
                          <li key={link.cmsKey} style={{ padding: "4px 0" }}>
                            <FooterLinkItem link={link} lang={lang} />
                          </li>
                        ))}
                      </ul>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        {/* Divider */}
        <div
          style={{
            borderTop: `1px solid ${BORDER}`,
            marginTop: "24px",
            paddingTop: "18px",
          }}
        >
          {/* Bottom bar — row on desktop, stacked on mobile */}
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <span
              data-cms-key="footer.copyright"
              style={{ fontSize: "12px", color: TEXT }}
            >
              {COPYRIGHT}
            </span>

            <span
              style={{ fontSize: "12px", color: TEXT }}
              className="flex items-center"
            >
              <span data-cms-key="footer.region">{REGION}</span>
              <span aria-hidden="true" style={{ margin: "0 8px" }}>
                |
              </span>
              <button
                type="button"
                onClick={toggleLang}
                data-cms-key="footer.lang"
                aria-label="Switch language"
                style={{
                  background: "transparent",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  fontSize: "12px",
                  color: TEXT,
                  transition: "color 0.2s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = TEXT_DARK)}
                onMouseLeave={(e) => (e.currentTarget.style.color = TEXT)}
              >
                {LANG_LABEL[lang]}
              </button>
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
