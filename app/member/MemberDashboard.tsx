"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  Apple,
  Wallet,
  CalendarPlus,
  QrCode as QrCodeIcon,
  X,
  LogOut,
  ChevronLeft,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { resolveTier, type Tier } from "@/lib/data/pricing";
import type { MemberData, MemberBooking } from "@/lib/data/getMember";

const SUBTLE = "#86868B";
const GREEN = "#22C55E";
const BORDER_DARK = "#2D2D2D";
const DANGER = "#FF453A";

const FONT_FAMILY =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Helvetica, Arial, sans-serif";

const SPRING = { type: "spring", stiffness: 320, damping: 30 } as const;

// Tier-based card gradient.
const TIER_GRADIENT: Record<string, string> = {
  amateur: "linear-gradient(135deg, #2A2A2E 0%, #141416 100%)",
  century: "linear-gradient(135deg, #4A3A12 0%, #1A1408 100%)",
  maximum: "linear-gradient(135deg, #123A1F 0%, #08160C 100%)",
};
const TIER_ACCENT: Record<string, string> = {
  amateur: "#86868B",
  century: "#F59E0B",
  maximum: "#22C55E",
};

type TabId = "bookings" | "points" | "settings";

// Decorative QR rendering (visual only; real QR is issued at booking time).
function QRGlyph({ data, size = 200, dark = false }: { data: string; size?: number; dark?: boolean }) {
  const cells = 21;
  const grid = useMemo(() => {
    const g: boolean[][] = Array.from({ length: cells }, () => Array(cells).fill(false));
    const finder = (r: number, c: number) => {
      for (let dr = 0; dr < 7; dr++)
        for (let dc = 0; dc < 7; dc++) {
          const border = dr === 0 || dr === 6 || dc === 0 || dc === 6;
          const inner = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
          g[r + dr][c + dc] = border || inner;
        }
    };
    finder(0, 0);
    finder(0, 14);
    finder(14, 0);
    let seed = 0;
    for (let i = 0; i < data.length; i++) seed = (seed * 31 + data.charCodeAt(i)) & 0xffff;
    for (let r = 0; r < cells; r++)
      for (let c = 0; c < cells; c++) {
        if (g[r][c]) continue;
        if (r < 7 && c < 7) continue;
        if (r < 7 && c >= 14) continue;
        if (r >= 14 && c < 7) continue;
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        g[r][c] = (seed >> 16) % 3 === 0;
      }
    return g;
  }, [data]);

  const cell = size / cells;
  const fg = dark ? "#000000" : "#FFFFFF";
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label="QR code" role="img">
      <rect width={size} height={size} fill={dark ? "#FFFFFF" : "transparent"} />
      {grid.map((row, r) =>
        row.map((on, c) =>
          on ? <rect key={`${r}-${c}`} x={c * cell} y={r * cell} width={cell} height={cell} fill={fg} /> : null
        )
      )}
    </svg>
  );
}

function formatDate(iso: string | null, locale: string, withTime = false): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
      ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

export default function MemberDashboard({ data, tiers }: { data: MemberData; tiers: Tier[] }) {
  const t = useTranslations("memberPage");
  const locale = useLocale();
  const router = useRouter();
  const { user, bookings, points, stats } = data;

  const [tab, setTab] = useState<TabId>("bookings");
  const [qrBooking, setQrBooking] = useState<MemberBooking | null>(null);

  const { current, next, progress, pointsToNext } = resolveTier(user.points, tiers);
  const tierId = current.id;
  const accent = TIER_ACCENT[tierId] ?? GREEN;

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <div style={{ fontFamily: FONT_FAMILY, background: "linear-gradient(180deg, #0A1A0F 0%, #18181B 46%, #0A1A0F 100%)", minHeight: "100vh", color: "white" }}>
      {/* Lightweight dashboard header (NOT the marketing Nav — its locale switch
          would route to a non-existent /[locale]/member). */}
      <DashboardHeader displayName={user.display_name} />

      <div style={{ maxWidth: "760px", margin: "0 auto", padding: "16px 20px 96px" }}>
        {/* ── Member card (boarding pass) ── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          style={{
            position: "relative",
            borderRadius: "24px",
            border: `1px solid ${BORDER_DARK}`,
            background: TIER_GRADIENT[tierId] ?? TIER_GRADIENT.amateur,
            padding: "28px",
            overflow: "hidden",
          }}
        >
          {/* Header row */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "28px" }}>
            <div>
              <div style={{ fontSize: "26px", fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1 }}>248</div>
              <div style={{ fontSize: "11px", letterSpacing: "0.18em", color: "rgba(255,255,255,0.6)", marginTop: "2px" }}>
                SNOOKER
              </div>
            </div>
            <span style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.12em", color: "rgba(255,255,255,0.7)" }} data-cms-key="member.card_label">
              {t("card_label")}
            </span>
          </div>

          {/* Passenger */}
          <div style={{ borderTop: "1px dashed rgba(255,255,255,0.2)", paddingTop: "20px" }}>
            <FieldLabel>{t("card_passenger")}</FieldLabel>
            <div style={{ fontSize: "24px", fontWeight: 700, letterSpacing: "-0.01em", marginTop: "2px" }}>
              {user.display_name ?? "—"}
            </div>
          </div>

          {/* Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", margin: "24px 0" }}>
            <div>
              <FieldLabel>{t("card_member_since")}</FieldLabel>
              <Value>{formatDate(user.created_at, locale)}</Value>
            </div>
            <div>
              <FieldLabel>{t("card_tier")}</FieldLabel>
              <Value>
                <span style={{ color: accent, textTransform: "uppercase", fontWeight: 700 }}>{tierId}</span>
              </Value>
            </div>
            <div>
              <FieldLabel>{t("card_points")}</FieldLabel>
              <Value>
                <span style={{ fontSize: "22px", fontWeight: 800 }}>{user.points.toLocaleString()}</span>
                <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.6)", marginLeft: "4px" }}>pts</span>
              </Value>
            </div>
            <div>
              <FieldLabel>{t("card_member_no")}</FieldLabel>
              <Value>
                <span style={{ fontFamily: "ui-monospace, monospace", fontSize: "15px" }}>{user.member_code}</span>
              </Value>
            </div>
          </div>

          {/* QR strip */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "16px",
              background: "rgba(0,0,0,0.35)",
              borderRadius: "14px",
            }}
          >
            <QRGlyph data={user.member_code} size={132} />
          </div>
        </motion.div>

        {/* Wallet buttons */}
        <div style={{ display: "flex", gap: "12px", marginTop: "16px", flexWrap: "wrap" }}>
          <WalletButton icon={<Apple size={18} strokeWidth={2} />} label={t("add_apple_wallet")} cmsKey="member.add_apple_wallet" />
          <WalletButton icon={<Wallet size={18} strokeWidth={2} />} label={t("add_google_wallet")} cmsKey="member.add_google_wallet" />
        </div>

        {/* Stats row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginTop: "24px" }}>
          <StatCard label={t("stat_bookings")} value={`${stats.bookings}`} unit={t("stat_bookings_unit")} />
          <StatCard label={t("stat_hours")} value={`${stats.hours}`} unit={t("stat_hours_unit")} />
          <StatCard label={t("stat_spent")} value={`HK$${stats.spent.toLocaleString()}`} />
        </div>

        {/* Tier progress */}
        <div style={{ marginTop: "28px", border: `1px solid ${BORDER_DARK}`, borderRadius: "20px", padding: "24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "16px" }}>
            <h3 style={{ fontSize: "16px", fontWeight: 600, margin: 0 }} data-cms-key="member.tier_progress_title">
              {t("tier_progress_title")}
            </h3>
            <span style={{ fontSize: "13px", color: SUBTLE }}>
              {next ? t("points_to_next", { pts: pointsToNext.toLocaleString() }) : t("max_tier_reached")}
            </span>
          </div>
          <div style={{ height: "8px", borderRadius: "100px", background: "rgba(255,255,255,0.1)", overflow: "hidden" }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.round(progress * 100)}%` }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              style={{ height: "100%", background: accent, borderRadius: "100px" }}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "10px", fontSize: "12px", color: SUBTLE, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            <span>{current.id}</span>
            {next && <span>{next.id}</span>}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: "4px", marginTop: "32px", borderBottom: `1px solid ${BORDER_DARK}` }}>
          {([
            { id: "bookings", key: "tab_bookings" },
            { id: "points", key: "tab_points" },
            { id: "settings", key: "tab_settings" },
          ] as const).map((tabItem) => {
            const active = tab === tabItem.id;
            return (
              <button
                key={tabItem.id}
                type="button"
                onClick={() => setTab(tabItem.id)}
                data-cms-key={`member.${tabItem.key}`}
                style={{
                  position: "relative",
                  padding: "14px 12px",
                  fontSize: "15px",
                  fontWeight: active ? 600 : 500,
                  color: active ? "white" : SUBTLE,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  minHeight: 44,
                  fontFamily: FONT_FAMILY,
                }}
              >
                {t(tabItem.key)}
                {active && (
                  <motion.span
                    layoutId="member-tab-underline"
                    style={{ position: "absolute", left: "12px", right: "12px", bottom: "-1px", height: "2px", background: GREEN }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Tab panels */}
        <div style={{ marginTop: "28px" }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              {tab === "bookings" && <BookingsTab bookings={bookings} locale={locale} onViewQr={setQrBooking} />}
              {tab === "points" && <PointsTab points={points} balance={user.points} locale={locale} />}
              {tab === "settings" && <SettingsTab user={user} onSignOut={signOut} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* QR modal */}
      <QrModal booking={qrBooking} onClose={() => setQrBooking(null)} locale={locale} />
    </div>
  );
}

/* ── Small presentational helpers ── */
function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span style={{ fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.5)" }}>{children}</span>;
}
function Value({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: "16px", fontWeight: 600, marginTop: "4px" }}>{children}</div>;
}

function DashboardHeader({ displayName }: { displayName: string | null }) {
  const t = useTranslations("memberPage");
  const locale = useLocale();
  const router = useRouter();

  const LOCALES = ["zh-HK", "zh-CN", "en", "ja"] as const;
  const LABELS: Record<string, string> = { "zh-HK": "繁", "zh-CN": "简", en: "EN", ja: "JP" };

  // Cookie-based locale toggle (no route change — /member is single-path).
  const cycleLocale = () => {
    const idx = LOCALES.indexOf(locale as (typeof LOCALES)[number]);
    const next = LOCALES[(idx + 1) % LOCALES.length];
    document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  };

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 20,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "16px 20px",
        background: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        borderBottom: `1px solid ${BORDER_DARK}`,
      }}
    >
      <a href="/" style={{ display: "flex", alignItems: "center", gap: "8px", color: "white", textDecoration: "none" }} aria-label="248 Snooker">
        <ChevronLeft size={20} strokeWidth={2} color={SUBTLE} />
        <span style={{ fontSize: "18px", fontWeight: 800, letterSpacing: "-0.01em" }}>248</span>
      </a>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span style={{ fontSize: "14px", color: SUBTLE }}>
          {t("greeting")}{displayName ? `, ${displayName}` : ""}
        </span>
        <button
          type="button"
          onClick={cycleLocale}
          aria-label="Switch language"
          style={{ color: "white", fontSize: "13px", fontWeight: 500, background: "rgba(255,255,255,0.1)", border: "none", borderRadius: "8px", padding: "6px 10px", cursor: "pointer", minHeight: 36 }}
        >
          {LABELS[locale] ?? "中"}
        </button>
      </div>
    </header>
  );
}

function WalletButton({ icon, label, cmsKey }: { icon: React.ReactNode; label: string; cmsKey: string }) {
  return (
    <button
      type="button"
      data-cms-key={cmsKey}
      style={{
        flex: "1 1 160px",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
        minHeight: 48,
        padding: "0 18px",
        borderRadius: "12px",
        border: "1px solid rgba(255,255,255,0.18)",
        background: "#0A0A0A",
        color: "white",
        fontSize: "14px",
        fontWeight: 600,
        cursor: "pointer",
        fontFamily: FONT_FAMILY,
      }}
    >
      {icon}
      {label}
    </button>
  );
}

function StatCard({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div style={{ border: `1px solid ${BORDER_DARK}`, borderRadius: "16px", padding: "18px 16px", textAlign: "center" }}>
      <div style={{ fontSize: "22px", fontWeight: 700, letterSpacing: "-0.02em" }}>
        {value}
        {unit ? <span style={{ fontSize: "12px", color: SUBTLE, marginLeft: "3px", fontWeight: 400 }}>{unit}</span> : null}
      </div>
      <div style={{ fontSize: "12px", color: SUBTLE, marginTop: "6px" }}>{label}</div>
    </div>
  );
}

/* ── Tabs ── */
function StatusBadge({ status }: { status: string }) {
  const t = useTranslations("memberPage");
  const map: Record<string, { label: string; color: string }> = {
    confirmed: { label: t("status_confirmed"), color: GREEN },
    cancelled: { label: t("status_cancelled"), color: DANGER },
    completed: { label: t("status_completed"), color: SUBTLE },
  };
  const s = map[status] ?? map.confirmed;
  return (
    <span style={{ fontSize: "12px", fontWeight: 600, color: s.color, background: `${s.color}1f`, borderRadius: "100px", padding: "3px 10px" }}>
      {s.label}
    </span>
  );
}

function BookingsTab({
  bookings,
  locale,
  onViewQr,
}: {
  bookings: MemberBooking[];
  locale: string;
  onViewQr: (b: MemberBooking) => void;
}) {
  const t = useTranslations("memberPage");
  if (bookings.length === 0) {
    return <EmptyState text={t("no_bookings")} />;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {bookings.map((b) => (
        <div key={b.id} style={{ border: `1px solid ${BORDER_DARK}`, borderRadius: "16px", padding: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
            <div>
              <div style={{ fontSize: "16px", fontWeight: 600 }}>{formatDate(b.date, locale)}</div>
              <div style={{ fontSize: "14px", color: SUBTLE, marginTop: "2px" }}>
                {b.startTime?.slice(11, 16) || b.startTime || "—"}
                {b.endTime ? ` – ${b.endTime.slice(11, 16) || b.endTime}` : ""}
                {b.tableId ? ` · ${t("booking_table")} ${b.tableId}` : ""}
              </div>
              <div style={{ fontSize: "14px", color: SUBTLE, marginTop: "2px" }}>
                {b.durationHours ? `${b.durationHours}h · ` : ""}HK${b.price}
              </div>
            </div>
            <StatusBadge status={b.status} />
          </div>
          <div style={{ display: "flex", gap: "10px", marginTop: "16px", flexWrap: "wrap" }}>
            <SmallButton onClick={() => onViewQr(b)} icon={<QrCodeIcon size={15} strokeWidth={2} />} label={t("booking_view_qr")} cmsKey="member.booking_view_qr" />
            <SmallButton
              href={calendarLink(b)}
              icon={<CalendarPlus size={15} strokeWidth={2} />}
              label={t("booking_add_calendar")}
              cmsKey="member.booking_add_calendar"
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function PointsTab({ points, balance, locale }: { points: import("@/lib/data/getMember").PointsEntry[]; balance: number; locale: string }) {
  const t = useTranslations("memberPage");
  const earn = t.raw("points_earn") as string[];
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "16px" }}>
        <span style={{ fontSize: "14px", color: SUBTLE }} data-cms-key="member.points_running_total">{t("points_running_total")}</span>
        <span style={{ fontSize: "24px", fontWeight: 800 }}>{balance.toLocaleString()} <span style={{ fontSize: "13px", color: SUBTLE }}>pts</span></span>
      </div>

      {points.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {points.map((p, i) => (
            <div
              key={p.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "16px 0",
                borderBottom: i < points.length - 1 ? `1px solid ${BORDER_DARK}` : "none",
              }}
            >
              <div>
                <div style={{ fontSize: "15px" }}>{p.description || "—"}</div>
                <div style={{ fontSize: "12px", color: SUBTLE, marginTop: "2px" }}>{formatDate(p.date, locale)}</div>
              </div>
              <span style={{ fontSize: "16px", fontWeight: 700, color: p.delta >= 0 ? GREEN : DANGER }}>
                {p.delta >= 0 ? "+" : ""}
                {p.delta}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState text={t("no_points")} />
      )}

      {/* Earn ways */}
      <div style={{ marginTop: "32px", border: `1px solid ${BORDER_DARK}`, borderRadius: "16px", padding: "20px" }}>
        <h4 style={{ fontSize: "14px", fontWeight: 600, margin: "0 0 14px" }} data-cms-key="member.points_earn_title">{t("points_earn_title")}</h4>
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "10px" }}>
          {earn.map((e, i) => (
            <li key={e} style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "14px", color: "rgba(255,255,255,0.75)" }} data-cms-key={`member.points_earn.${i}`}>
              <span aria-hidden="true" style={{ width: "5px", height: "5px", borderRadius: "50%", background: GREEN }} />
              {e}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function SettingsTab({ user, onSignOut }: { user: MemberData["user"]; onSignOut: () => void }) {
  const t = useTranslations("memberPage");
  const [name, setName] = useState(user.display_name ?? "");
  const [phone, setPhone] = useState(user.phone ?? "");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notif, setNotif] = useState({ booking: true, points: true, promo: false });

  const save = async () => {
    setSaving(true);
    try {
      const supabase = createClient();
      await supabase.from("users").update({ display_name: name, phone }).eq("id", user.id);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      /* surfaced via lack of "saved" confirmation */
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = () => {
    if (window.confirm(t("delete_confirm"))) {
      // Account deletion requires a privileged server action; placeholder hook.
      window.alert(t("delete_confirm"));
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    minHeight: 48,
    padding: "0 16px",
    borderRadius: "12px",
    border: `1px solid ${BORDER_DARK}`,
    background: "#0A0A0A",
    color: "white",
    fontSize: "15px",
    fontFamily: FONT_FAMILY,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <Field label={t("settings_display_name")}>
        <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} aria-label={t("settings_display_name")} />
      </Field>
      <Field label={t("settings_email")}>
        <input value={user.email ?? ""} readOnly style={{ ...inputStyle, color: SUBTLE, cursor: "not-allowed" }} aria-label={t("settings_email")} />
      </Field>
      <Field label={t("settings_phone")}>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} style={inputStyle} inputMode="tel" aria-label={t("settings_phone")} />
      </Field>

      {/* Notifications */}
      <div style={{ border: `1px solid ${BORDER_DARK}`, borderRadius: "16px", padding: "20px" }}>
        <h4 style={{ fontSize: "14px", fontWeight: 600, margin: "0 0 16px" }} data-cms-key="member.settings_notifications">{t("settings_notifications")}</h4>
        <Toggle label={t("notif_booking")} on={notif.booking} onChange={(v) => setNotif((s) => ({ ...s, booking: v }))} />
        <Toggle label={t("notif_points")} on={notif.points} onChange={(v) => setNotif((s) => ({ ...s, points: v }))} />
        <Toggle label={t("notif_promo")} on={notif.promo} onChange={(v) => setNotif((s) => ({ ...s, promo: v }))} last />
      </div>

      <button
        type="button"
        onClick={save}
        disabled={saving}
        style={{
          minHeight: 52,
          borderRadius: "14px",
          border: "none",
          background: GREEN,
          color: "#000",
          fontSize: "16px",
          fontWeight: 700,
          cursor: saving ? "default" : "pointer",
          opacity: saving ? 0.6 : 1,
        }}
        data-cms-key="member.save"
      >
        {saved ? t("saved") : t("save")}
      </button>

      {/* Danger zone */}
      <div style={{ border: `1px solid ${DANGER}55`, borderRadius: "16px", padding: "20px", marginTop: "12px" }}>
        <h4 style={{ fontSize: "14px", fontWeight: 600, color: DANGER, margin: "0 0 12px" }} data-cms-key="member.danger_zone">{t("danger_zone")}</h4>
        <button
          type="button"
          onClick={confirmDelete}
          style={{ minHeight: 44, padding: "0 18px", borderRadius: "12px", border: `1px solid ${DANGER}`, background: "transparent", color: DANGER, fontSize: "14px", fontWeight: 600, cursor: "pointer" }}
          data-cms-key="member.delete_account"
        >
          {t("delete_account")}
        </button>
      </div>

      <button
        type="button"
        onClick={onSignOut}
        style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px", minHeight: 48, borderRadius: "12px", border: `1px solid ${BORDER_DARK}`, background: "transparent", color: "white", fontSize: "15px", fontWeight: 500, cursor: "pointer" }}
        data-cms-key="member.sign_out"
      >
        <LogOut size={16} strokeWidth={2} />
        {t("sign_out")}
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block" }}>
      <span style={{ display: "block", fontSize: "13px", color: SUBTLE, marginBottom: "8px" }}>{label}</span>
      {children}
    </label>
  );
}

function Toggle({ label, on, onChange, last }: { label: string; on: boolean; onChange: (v: boolean) => void; last?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: last ? "none" : `1px solid ${BORDER_DARK}` }}>
      <span style={{ fontSize: "15px" }}>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={() => onChange(!on)}
        style={{
          width: "48px",
          height: "30px",
          borderRadius: "100px",
          border: "none",
          background: on ? GREEN : "rgba(255,255,255,0.18)",
          position: "relative",
          cursor: "pointer",
          transition: "background 0.2s ease",
          flexShrink: 0,
        }}
      >
        <motion.span
          animate={{ x: on ? 20 : 2 }}
          transition={SPRING}
          style={{ position: "absolute", top: "3px", left: 0, width: "24px", height: "24px", borderRadius: "50%", background: "white" }}
        />
      </button>
    </div>
  );
}

function SmallButton({
  label,
  icon,
  onClick,
  href,
  cmsKey,
}: {
  label: string;
  icon: React.ReactNode;
  onClick?: () => void;
  href?: string;
  cmsKey: string;
}) {
  const style: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    minHeight: 40,
    padding: "0 14px",
    borderRadius: "100px",
    border: `1px solid ${BORDER_DARK}`,
    background: "transparent",
    color: "white",
    fontSize: "13px",
    fontWeight: 500,
    cursor: "pointer",
    textDecoration: "none",
    fontFamily: FONT_FAMILY,
  };
  return href ? (
    <a href={href} download style={style} data-cms-key={cmsKey}>
      {icon}
      {label}
    </a>
  ) : (
    <button type="button" onClick={onClick} style={style} data-cms-key={cmsKey}>
      {icon}
      {label}
    </button>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div style={{ textAlign: "center", padding: "48px 24px", color: SUBTLE, fontSize: "15px" }}>{text}</div>
  );
}

function QrModal({ booking, onClose, locale }: { booking: MemberBooking | null; onClose: () => void; locale: string }) {
  const t = useTranslations("memberPage");
  return (
    <AnimatePresence>
      {booking && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={SPRING}
            onClick={(e) => e.stopPropagation()}
            style={{ position: "relative", width: "100%", maxWidth: "360px", background: "#0A0A0A", border: `1px solid ${BORDER_DARK}`, borderRadius: "24px", padding: "32px", textAlign: "center", fontFamily: FONT_FAMILY }}
          >
            <button type="button" onClick={onClose} aria-label={t("close")} style={{ position: "absolute", top: "16px", right: "16px", width: "36px", height: "36px", borderRadius: "50%", border: "none", background: "rgba(255,255,255,0.1)", color: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <X size={18} />
            </button>
            <h3 style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 20px", color: "white" }} data-cms-key="member.qr_modal_title">
              {t("qr_modal_title")}
            </h3>
            <div style={{ display: "flex", justifyContent: "center", padding: "20px", background: "white", borderRadius: "16px" }}>
              <QRGlyph data={booking.reference ?? booking.id} size={200} dark />
            </div>
            <div style={{ marginTop: "20px" }}>
              <div style={{ fontSize: "12px", color: SUBTLE, textTransform: "uppercase", letterSpacing: "0.06em" }} data-cms-key="member.qr_reference">
                {t("qr_reference")}
              </div>
              <div style={{ fontSize: "16px", fontWeight: 700, fontFamily: "ui-monospace, monospace", marginTop: "4px", color: "white" }}>
                {booking.reference ?? booking.id.slice(0, 12)}
              </div>
              <div style={{ fontSize: "14px", color: SUBTLE, marginTop: "8px" }}>
                {formatDate(booking.date, locale)}
                {booking.startTime ? ` · ${booking.startTime.slice(11, 16) || booking.startTime}` : ""}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Build a Google Calendar "add event" link from a booking.
function calendarLink(b: MemberBooking): string {
  const title = encodeURIComponent("248 Snooker");
  const toCal = (iso: string | null) => (iso ? iso.replace(/[-:]/g, "").replace(/\.\d+/, "") : "");
  const start = toCal(b.startTime);
  const end = toCal(b.endTime);
  const dates = start && end ? `&dates=${start}/${end}` : "";
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}${dates}`;
}
