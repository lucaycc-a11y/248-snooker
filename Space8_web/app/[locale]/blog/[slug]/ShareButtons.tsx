"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Share2, Link2, Check } from "lucide-react";

const SUBTLE = "#86868B";
const BORDER_DARK = "#2D2D2D";

// WhatsApp share + copy-to-clipboard. Needs the browser, hence a client island.
export default function ShareButtons({ url, title }: { url: string; title: string }) {
  const t = useTranslations("blog");
  const [copied, setCopied] = useState(false);

  const waHref = `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — no-op */
    }
  };

  const btn: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    minHeight: 44,
    padding: "0 18px",
    borderRadius: "100px",
    border: `1px solid ${BORDER_DARK}`,
    background: "transparent",
    color: "white",
    fontSize: "14px",
    fontWeight: 500,
    cursor: "pointer",
    textDecoration: "none",
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
      <span style={{ fontSize: "14px", color: SUBTLE }} data-cms-key="blog.share">
        {t("share")}
      </span>
      <a href={waHref} target="_blank" rel="noopener noreferrer" style={btn} aria-label={t("share_whatsapp")}>
        <Share2 size={16} strokeWidth={2} />
        WhatsApp
      </a>
      <button type="button" onClick={copy} style={btn} aria-label={t("copy_link")}>
        {copied ? <Check size={16} strokeWidth={2} color="#22C55E" /> : <Link2 size={16} strokeWidth={2} />}
        {copied ? t("copied") : t("copy_link")}
      </button>
    </div>
  );
}
