"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations } from "next-intl";
import { Check, X, AlertTriangle } from "lucide-react";

const DARK = "#1D1D1F";
const SUBTLE = "#86868B";
const GREEN = "#22C55E";
const DANGER = "#FF453A";
const AMBER = "#F59E0B";
const DIVIDER = "#E5E5E5";

const FONT_FAMILY =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Helvetica, Arial, sans-serif";

const EASE = [0.16, 1, 0.3, 1] as const;

type TabId = "terms" | "privacy" | "refund" | "rules";
const TABS: { id: TabId; key: string }[] = [
  { id: "terms", key: "tab_terms" },
  { id: "privacy", key: "tab_privacy" },
  { id: "refund", key: "tab_refund" },
  { id: "rules", key: "tab_rules" },
];

type Section = { title: string; body: string };
type RefundRow = { case: string; result: string };
type RefundTime = { method: string; time: string };

// Numbered legal sections (terms, privacy) — shared renderer.
function SectionList({ items, cmsPrefix }: { items: Section[]; cmsPrefix: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "40px" }}>
      {items.map((s, i) => (
        <motion.div
          key={s.title}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5, ease: EASE, delay: Math.min(i * 0.04, 0.2) }}
        >
          <h3
            style={{
              display: "flex",
              gap: "12px",
              fontSize: "20px",
              fontWeight: 700,
              letterSpacing: "-0.01em",
              color: DARK,
              margin: "0 0 10px",
            }}
            data-cms-key={`${cmsPrefix}.${i}.title`}
          >
            <span style={{ color: GREEN, fontVariantNumeric: "tabular-nums" }}>
              {String(i + 1).padStart(2, "0")}
            </span>
            {s.title}
          </h3>
          <p
            style={{
              fontSize: "16px",
              lineHeight: 1.65,
              color: "#494951",
              margin: 0,
              paddingLeft: "36px",
            }}
            data-cms-key={`${cmsPrefix}.${i}.content`}
          >
            {s.body}
          </p>
        </motion.div>
      ))}
    </div>
  );
}

function RefundPanel() {
  const t = useTranslations("legal");
  const rows = t.raw("refund_rows") as RefundRow[];
  const times = t.raw("refund_times") as RefundTime[];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "48px" }}>
      {/* Refund matrix — card list on mobile, table-like rows on desktop */}
      <div style={{ border: `1px solid ${DIVIDER}`, borderRadius: "16px", overflow: "hidden" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: "16px",
            padding: "16px 20px",
            background: "#F5F5F7",
            fontSize: "13px",
            fontWeight: 600,
            color: SUBTLE,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          <span data-cms-key="legal.refund.head.case">{t("refund_table_case")}</span>
          <span data-cms-key="legal.refund.head.result">{t("refund_table_result")}</span>
        </div>
        {rows.map((r, i) => {
          const full = r.result.includes("100");
          const none = r.result.includes("不") || /No refund|返金なし/.test(r.result);
          const color = full ? GREEN : none ? DANGER : AMBER;
          return (
            <div
              key={r.case}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: "16px",
                alignItems: "center",
                padding: "18px 20px",
                borderTop: `1px solid ${DIVIDER}`,
                fontSize: "16px",
                color: DARK,
              }}
            >
              <span data-cms-key={`legal.refund.row.${i}.case`}>{r.case}</span>
              <span style={{ fontWeight: 600, color }} data-cms-key={`legal.refund.row.${i}.result`}>
                {r.result}
              </span>
            </div>
          );
        })}
      </div>

      {/* Processing times */}
      <div>
        <h3
          style={{ fontSize: "20px", fontWeight: 700, color: DARK, margin: "0 0 16px" }}
          data-cms-key="legal.refund.times.title"
        >
          {t("refund_times_title")}
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {times.map((tm, i) => (
            <div
              key={tm.method}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "16px",
                fontSize: "16px",
                color: "#494951",
                padding: "8px 0",
                borderBottom: i < times.length - 1 ? `1px solid ${DIVIDER}` : "none",
              }}
            >
              <span data-cms-key={`legal.refund.time.${i}.method`}>{tm.method}</span>
              <span style={{ fontWeight: 500, color: DARK }} data-cms-key={`legal.refund.time.${i}.time`}>
                {tm.time}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RulesPanel() {
  const t = useTranslations("legal");
  const allowed = t.raw("rules_allowed") as string[];
  const prohibited = t.raw("rules_prohibited") as string[];
  const notes = t.raw("rules_notes") as string[];

  const groups = [
    { title: t("rules_allowed_title"), items: allowed, Icon: Check, color: GREEN, cms: "allowed" },
    { title: t("rules_prohibited_title"), items: prohibited, Icon: X, color: DANGER, cms: "prohibited" },
    { title: t("rules_notes_title"), items: notes, Icon: AlertTriangle, color: AMBER, cms: "notes" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "40px" }}>
      {groups.map((g) => (
        <div key={g.cms}>
          <h3
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              fontSize: "20px",
              fontWeight: 700,
              color: DARK,
              margin: "0 0 16px",
            }}
            data-cms-key={`legal.rules.${g.cms}.title`}
          >
            <g.Icon size={22} color={g.color} strokeWidth={2.5} />
            {g.title}
          </h3>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "12px" }}>
            {g.items.map((item, i) => (
              <li
                key={item}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "12px",
                  fontSize: "16px",
                  lineHeight: 1.5,
                  color: "#494951",
                }}
                data-cms-key={`legal.rules.${g.cms}.${i}`}
              >
                <span
                  aria-hidden="true"
                  style={{ marginTop: "9px", width: "6px", height: "6px", borderRadius: "50%", background: g.color, flexShrink: 0 }}
                />
                {item}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export default function LegalContent({ initialTab, lastUpdated }: { initialTab: TabId; lastUpdated: string }) {
  const t = useTranslations("legal");
  const [tab, setTab] = useState<TabId>(initialTab);

  const termsSections = t.raw("terms_sections") as Section[];
  const privacySections = t.raw("privacy_sections") as Section[];

  return (
    <div data-nav-theme="dark" style={{ background: "#ffffff", fontFamily: FONT_FAMILY }}>
      {/* Hero — black */}
      <section
        data-nav-theme="dark"
        style={{ background: "#000000", color: "white", padding: "140px 24px 64px" }}
      >
        <div style={{ maxWidth: "820px", margin: "0 auto" }}>
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE }}
            style={{ fontSize: "clamp(40px, 8vw, 64px)", fontWeight: 700, letterSpacing: "-0.03em", margin: 0 }}
            data-cms-key="legal.title"
          >
            {t("title")}
          </motion.h1>
          <p
            style={{ fontSize: "17px", color: "rgba(255,255,255,0.6)", margin: "16px 0 0", maxWidth: "560px" }}
            data-cms-key="legal.subtitle"
          >
            {t("subtitle")}
          </p>
        </div>
      </section>

      {/* Sticky tab bar */}
      <div
        data-nav-theme="light"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 30,
          background: "rgba(255,255,255,0.85)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          borderBottom: `1px solid ${DIVIDER}`,
        }}
      >
        <div
          className="no-scrollbar"
          style={{
            maxWidth: "820px",
            margin: "0 auto",
            display: "flex",
            gap: "4px",
            padding: "0 16px",
            overflowX: "auto",
          }}
        >
          {TABS.map((tabItem) => {
            const active = tab === tabItem.id;
            return (
              <button
                key={tabItem.id}
                type="button"
                onClick={() => setTab(tabItem.id)}
                data-cms-key={`legal.${tabItem.key}`}
                style={{
                  position: "relative",
                  flexShrink: 0,
                  padding: "16px 16px",
                  fontSize: "15px",
                  fontWeight: active ? 600 : 500,
                  color: active ? DARK : SUBTLE,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontFamily: FONT_FAMILY,
                  minHeight: 44,
                }}
              >
                {t(tabItem.key)}
                {active && (
                  <motion.span
                    layoutId="legal-tab-underline"
                    style={{
                      position: "absolute",
                      left: "16px",
                      right: "16px",
                      bottom: 0,
                      height: "2px",
                      background: GREEN,
                      borderRadius: "2px",
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <section style={{ padding: "clamp(48px, 8vw, 88px) 24px 96px" }}>
        <div style={{ maxWidth: "820px", margin: "0 auto" }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3, ease: EASE }}
            >
              {tab === "terms" && <SectionList items={termsSections} cmsPrefix="legal.terms.section" />}
              {tab === "privacy" && <SectionList items={privacySections} cmsPrefix="legal.privacy.section" />}
              {tab === "refund" && <RefundPanel />}
              {tab === "rules" && <RulesPanel />}
            </motion.div>
          </AnimatePresence>

          <p
            style={{ marginTop: "64px", fontSize: "14px", color: SUBTLE }}
            data-cms-key="legal.last_updated"
          >
            {t("last_updated")}: {lastUpdated}
          </p>
        </div>
      </section>
    </div>
  );
}
