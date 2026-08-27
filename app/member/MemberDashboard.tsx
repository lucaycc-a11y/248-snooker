"use client";

import { SITE_CONTACT } from "@/lib/site/contact";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CalendarPlus,
  QrCode as QrCodeIcon,
  Undo2,
  CalendarClock,
  Sparkles,
  X,
  LogOut,
  RotateCw,
  History,
  Ticket,
  Zap,
  Clock,
  Bell,
  Home,
  Settings2,
  Percent,
  Coins,
  Check,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { BackButton } from "@/components/ui";
import { resolveTier, type Tier } from "@/lib/data/pricing";
import type { MemberData, MemberBooking } from "@/lib/data/getMember";
import RefundConfirmModal from "@/components/member/RefundConfirmModal";
import ReschedulePicker from "@/components/member/ReschedulePicker";
import MemberQrGuide from "@/components/member/MemberQrGuide";
import { AmbientGlow } from "@/components/shared/AmbientGlow";
import { QRCode } from "@/components/shared/QRCode";

// ── Landing-aligned palette: black + liquid glass, green/amber/purple tiers. ──
const DEEP = "#0a0a0a"; // near-black base (QR modal)
const INK = "#f5f5f7"; // near-white text
const SUBTLE = "#A1A1A6"; // neutral grey (raised from #86868b — legibility on #000)
const BORDER = "rgba(255,255,255,0.1)"; // glass hairline (cards)
const HAIRLINE = "rgba(255,255,255,0.18)"; // glass hairline (emphasis)
const GREEN = "#22C55E"; // primary accent + semantic confirmed
const DANGER = "#FF453A";

const FONT_FAMILY =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Helvetica, Arial, sans-serif";
const DISPLAY = '"Bebas Neue", sans-serif';

const SPRING = { type: "spring", stiffness: 320, damping: 30 } as const;
const EASE = [0.16, 1, 0.3, 1] as const;

// Liquid-glass surface recipe for CSS-only surfaces (stats cards, booking list).
// The member card itself uses WebGL liquidglass, not these constants.
const GLASS_BG = "rgba(255,255,255,0.05)";
const GLASS_BLUR = "blur(20px) saturate(180%)";

// Tier accent matches the landing membership section: green / amber / purple.
const TIER_ACCENT: Record<string, string> = {
  amateur: "#22C55E",
  century: "#F59E0B",
  maximum: "#A78BFA",
};
// Subtle tier-coloured corner glow layered over the glass member card.
const TIER_GLOW: Record<string, string> = {
  amateur: "radial-gradient(120% 120% at 100% 0%, rgba(34,197,94,0.14), transparent 55%)",
  century: "radial-gradient(120% 120% at 100% 0%, rgba(245,158,11,0.14), transparent 55%)",
  maximum: "radial-gradient(120% 120% at 100% 0%, rgba(167,139,250,0.16), transparent 55%)",
};

// Display names for tier IDs — used wherever the raw ID would leak to the UI.
// Short English label matches the .font-label (Good Times, uppercase) style.
const TIER_TITLE: Record<string, string> = {
  amateur: "NOVA",
  century: "PLATINUM",
  maximum: "DIAMOND",
};

type TabId = "overview" | "bookings" | "points" | "settings" | "access";

// Number of days after which a past booking moves to "History"
const RECENT_DAYS = 30

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

export default function MemberDashboard({
  data,
  tiers,
  refundCutoffHours,
}: {
  data: MemberData;
  tiers: Tier[];
  refundCutoffHours: number;
}) {
  const t = useTranslations("memberPage");
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, points, stats } = data;
  const [bookings, setBookings] = useState<MemberBooking[]>(data.bookings);
  const [showHistory, setShowHistory] = useState(false);

  // Classify bookings into three buckets:
  // - upcoming: confirmed, future start time
  // - recent:   confirmed, within last RECENT_DAYS (default 30)
  // - history:  cancelled, refunded, or older than RECENT_DAYS
  const { upcomingBookings, recentBookings, historyBookings } = useMemo(() => {
    const now = Date.now()
    const cutoff = now - RECENT_DAYS * 86400_000

    const upcoming: MemberBooking[] = []
    const recent: MemberBooking[] = []
    const history: MemberBooking[] = []

    for (const b of bookings) {
      if (b.status === 'cancelled' || b.status === 'refunded') {
        history.push(b)
        continue
      }

      if (!b.date) {
        recent.push(b) // can't classify, show in recent
        continue
      }

      const bookingTime = new Date(b.date + 'T' + (b.startTime?.slice(11, 19) || b.startTime || '00:00:00')).getTime()
      if (Number.isNaN(bookingTime)) {
        recent.push(b)
        continue
      }

      if (bookingTime > now) {
        upcoming.push(b)
      } else if (bookingTime > cutoff) {
        recent.push(b)
      } else {
        history.push(b)
      }
    }

    return { upcomingBookings: upcoming, recentBookings: recent, historyBookings: history }
  }, [bookings])

  const activeBookings = useMemo(
    () => [...upcomingBookings, ...recentBookings],
    [upcomingBookings, recentBookings]
  )

  // Honour a ?tab= deep-link (e.g. the account menu's "Settings" → /member?tab=settings).
  const initialTab: TabId = ((): TabId => {
    const q = searchParams.get("tab");
    if (q === "bookings" || q === "points" || q === "settings" || q === "access") return q;
    return "overview";
  })();
  const [tab, setTab] = useState<TabId>(initialTab);
  const [fadeVisible, setFadeVisible] = useState(false);
  const tabsRef = useRef<HTMLDivElement>(null);
  const [qrBooking, setQrBooking] = useState<MemberBooking | null>(null);
  const [refundBooking, setRefundBooking] = useState<MemberBooking | null>(null);
  const [rescheduleBooking, setRescheduleBooking] = useState<MemberBooking | null>(null);
  const [memberQrDataUrl, setMemberQrDataUrl] = useState<string | null>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<Array<{
    id: string; type: string; message: string; read: boolean; created_at: string;
  }>>([]);
  const unreadCount = notifications.filter((n) => !n.read).length;

  // Tabs overflow fade — show gradient on mobile when tabs overflow
  // and the user hasn't scrolled to the rightmost end.
  useEffect(() => {
    const el = tabsRef.current;
    if (!el) return;
    const check = () => {
      setFadeVisible(el.scrollWidth > el.clientWidth && el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    };
    check();
    el.addEventListener("scroll", check);
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", check);
      ro.disconnect();
    };
  }, []);

  // Fetch member notifications from notification_log
  useEffect(() => {
    async function fetchNotifications() {
      try {
        const res = await fetch('/api/member/notifications')
        if (res.ok) {
          const data = await res.json()
          setNotifications(data.notifications ?? [])
        }
      } catch {
        // non-fatal — notification bell just shows 0
      }
    }
    fetchNotifications()
  }, [])

  const { current, next, progress, pointsToNext } = resolveTier(user.points, tiers);
  const tierId = current.id;
  const accent = TIER_ACCENT[tierId] ?? GREEN;

  // Fetch real scannable QR code for member card from API
  useEffect(() => {
    if (!user.member_code) return

    async function fetchQR() {
      try {
        const res = await fetch('/api/member/qr')
        if (!res.ok) {
          throw new Error(`QR fetch failed: ${res.status}`)
        }
        const data = await res.json()
        setMemberQrDataUrl(data.qrCode)
      } catch (err) {
        console.error('[MemberDashboard] QR fetch failed:', err)
      }
    }

    fetchQR()
  }, [user.member_code])

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <div
      style={{
        fontFamily: FONT_FAMILY,
        background: "#000",
        minHeight: "100vh",
        color: INK,
        position: "relative",
        isolation: "isolate",
      }}
    >
      {/* Shared brand ambient orbs, layered behind the tier-coloured backdrop below. */}
      <AmbientGlow />

      {/* Ambient tier-coloured backdrop — same TIER_GLOW recipe as the
          membership card, but full-page and animated (slow opacity breathe)
          so the whole page reads as "this member's colour", not just the card. */}
      <motion.div
        aria-hidden="true"
        animate={{ opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
          background: TIER_GLOW[tierId] ?? TIER_GLOW.amateur,
        }}
      />
      {/* Fixed back arrow — shared component, identical to the booking flow. */}
      <BackButton href="/" ariaLabel={t("back")} cmsKey="member.back" color={INK} />

      {/* Lightweight dashboard header (NOT the marketing Nav — its locale switch
          would route to a non-existent /[locale]/member). */}
      <DashboardHeader displayName={user.display_name} notifOpen={notifOpen} setNotifOpen={setNotifOpen} notifications={notifications} unreadCount={unreadCount} markAllRead={() => {
    fetch('/api/member/notifications', { method: 'PATCH' }).catch(() => {})
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }} />

      <div style={{ position: "relative", zIndex: 1, maxWidth: "760px", margin: "0 auto", padding: "16px 20px 96px" }}>
        {/* ── Membership card (club-card metaphor) ── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
          style={{
            position: "relative",
            borderRadius: "24px",
            border: "1px solid rgba(34,184,107,0.15)",
            background: `linear-gradient(160deg, rgba(44,44,48,0.92) 0%, rgba(10,10,10,1) 100%), ${TIER_GLOW[tierId] ?? TIER_GLOW.amateur}, ${GLASS_BG}`,
            backdropFilter: GLASS_BLUR,
            WebkitBackdropFilter: GLASS_BLUR,
            padding: "26px 28px",
            overflow: "hidden",
            minHeight: 210,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            gap: 28,
          }}
        >
          {/* Top: wordmark + tier */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontFamily: DISPLAY, fontSize: "24px", letterSpacing: "0.12em", color: INK, lineHeight: 1 }}>
                SPACE8
              </div>
              <div data-cms-key="member.card_label" className="font-label" style={{ fontSize: "10px", color: SUBTLE, marginTop: "6px" }}>
                {t("card_label")}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <FieldLabel>{t("card_tier")}</FieldLabel>
              <div className="font-label" style={{ fontFamily: DISPLAY, fontSize: "30px", color: accent, lineHeight: 1 }}>
                {TIER_TITLE[current.id] ?? current.id}
              </div>
            </div>
          </div>

          {/* Bottom: identity + QR */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 20 }}>
            <div style={{ minWidth: 0 }}>
              <FieldLabel>{t("card_passenger")}</FieldLabel>
              <div style={{ fontSize: "22px", fontWeight: 700, letterSpacing: "-0.01em", color: INK, marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {user.display_name ?? "—"}
              </div>
              <div data-cms-key="member.card_member_no" style={{ marginTop: "10px" }}>
                <FieldLabel>{t("card_member_no")}</FieldLabel>
                <div
                  className="font-code"
                  style={{
                    fontSize: "16px",
                    fontWeight: 600,
                    color: GREEN,
                    textShadow: "0 1px 1px rgba(0,0,0,0.55)",
                    marginTop: "2px",
                  }}
                >
                  {user.member_code}
                </div>
              </div>
              <div style={{ fontSize: "12px", color: SUBTLE, marginTop: "10px" }}>
                {t("card_member_since")} · {formatDate(user.created_at, locale)}
              </div>
            </div>

            {/* Membership QR tile */}
            <div
              style={{
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "10px",
                background: "#fdfcf8",
                borderRadius: "12px",
                boxShadow: "0 0 0 1px rgba(34,197,94,0.2), 0 0 20px rgba(34,197,94,0.15)",
              }}
            >
              <QRCode
                src={memberQrDataUrl}
                size={76}
                enlargeLabel={t("qr_tap_enlarge")}
                closeLabel={t("close")}
              />
            </div>
          </div>
        </motion.div>

        {/* ── Points + tier progress ── */}
        <div
          style={{
            marginTop: "24px",
            border: `1px solid ${BORDER}`,
            borderRadius: "20px",
            padding: "24px",
            background: GLASS_BG,
            backdropFilter: GLASS_BLUR,
            WebkitBackdropFilter: GLASS_BLUR,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span data-cms-key="member.card_points" className="font-label" style={{ fontSize: "11px", color: SUBTLE }}>
              {t("card_points")}
            </span>
            <span style={{ fontSize: "13px", color: SUBTLE }} data-cms-key="member.tier_progress_title">
              {t("tier_progress_title")}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "flex-end", gap: "8px", margin: "6px 0 20px" }}>
            <span style={{ fontFamily: DISPLAY, fontSize: "52px", lineHeight: 0.9, color: accent }}>
              {user.points.toLocaleString()}
            </span>
            <span style={{ fontSize: "14px", color: SUBTLE, marginBottom: "6px", letterSpacing: "0.08em" }}>PTS</span>
          </div>

          {/* Progress "orbit" — thin track + a ball riding the fill's leading
              edge (the track itself keeps overflow:hidden for the fill bar;
              the ball sits in a sibling, unclipped layer so it isn't cut off
              at the track's height). */}
          <div style={{ position: "relative", padding: "6px 0" }}>
            <div style={{ height: "3px", borderRadius: "100px", background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.round(progress * 100)}%` }}
                transition={{ duration: 0.9, ease: EASE }}
                style={{ height: "100%", background: GREEN, borderRadius: "100px" }}
              />
            </div>
            <motion.div
              initial={{ left: 0 }}
              animate={{ left: `${Math.round(progress * 100)}%` }}
              transition={{ duration: 0.9, ease: EASE }}
              aria-hidden="true"
              style={{
                position: "absolute",
                top: "50%",
                width: "14px",
                height: "14px",
                borderRadius: "50%",
                background: accent,
                boxShadow: `0 0 8px ${accent}`,
                transform: "translate(-50%, -50%)",
              }}
            />
          </div>
          <div className="font-label" style={{ display: "flex", justifyContent: "space-between", marginTop: "10px", fontSize: "12px", color: SUBTLE }}>
            <span>{TIER_TITLE[current.id] ?? current.id}</span>
            <span>{next ? t("points_to_next", { pts: pointsToNext.toLocaleString() }) : t("max_tier_reached")}</span>
            {next && <span>{TIER_TITLE[next.id] ?? next.id}</span>}
          </div>
        </div>

        {/* Stats row — Apple-Card style: no border box per stat, just a
            hairline divider between them, so the number itself is the hero.
            Glass surface (bg+blur) matches the member/points cards above. */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            marginTop: "16px",
            border: `1px solid ${BORDER}`,
            borderRadius: "16px",
            padding: "18px 0",
            background: GLASS_BG,
            backdropFilter: GLASS_BLUR,
            WebkitBackdropFilter: GLASS_BLUR,
          }}
        >
          <StatCard label={t("stat_bookings")} value={`${stats.bookings}`} unit={t("stat_bookings_unit")} />
          <StatCard label={t("stat_hours")} value={`${stats.hours}`} unit={t("stat_hours_unit")} last />
        </div>

        {/* Tabs — overflow container. Thin/auto scrollbar is a touch/mouse
            affordance; the sheer overflow also suppresses it on desktop. On
            mobile the right-edge fade (absolute overlay) hints more tabs. */}
        <div style={{ position: "relative" }}>
          <div
            ref={tabsRef}
            className="hide-scrollbar"
            style={{
              display: "flex",
              gap: "4px",
              marginTop: "32px",
              borderBottom: `1px solid ${BORDER}`,
              overflowX: "auto",
              scrollbarWidth: "thin",
              WebkitOverflowScrolling: "touch",
              scrollbarColor: "rgba(255,255,255,0.25) transparent",
            }}
          >
          {([
            { id: "overview" as TabId, key: "tab_overview", icon: <Home size={15} strokeWidth={2} /> },
            { id: "bookings" as TabId, key: "tab_bookings", icon: <Ticket size={15} strokeWidth={2} /> },
            { id: "points" as TabId, key: "tab_points", icon: <Coins size={15} strokeWidth={2} /> },
            { id: "settings" as TabId, key: "tab_settings", icon: <Settings2 size={15} strokeWidth={2} /> },
            { id: "access" as TabId, key: "tab_access", icon: <QrCodeIcon size={15} strokeWidth={2} /> },
          ]).map((tabItem) => {
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
                  color: active ? INK : SUBTLE,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  minHeight: 44,
                  flexShrink: 0,
                  fontFamily: FONT_FAMILY,
                }}
              >
                {tabItem.icon}
                <span style={{ marginLeft: 6 }}>{t(tabItem.key)}</span>
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
        {/* Right-edge scroll fade hint — visible only when the tabs overflow
            (mobile). CSS can't measure overflow, so JS sets `fadeVisible`. */}
        <div
          aria-hidden="true"
          className={fadeVisible ? "tabs-fade-on" : ""}
          style={{
            position: "absolute",
            top: "32px",
            right: 0,
            width: "48px",
            height: "44px",
            pointerEvents: "none",
            background: "linear-gradient(to left, rgba(0,0,0,0.9), rgba(0,0,0,0))",
            borderRadius: "12px",
            opacity: 0,
            transition: "opacity 0.25s ease",
          }}
        />
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
              {tab === "overview" && (
                <OverviewTab
                  user={user}
                  tierId={tierId}
                  accent={accent}
                  progress={progress}
                  pointsToNext={pointsToNext}
                  next={next}
                  current={current}
                  memberQrDataUrl={memberQrDataUrl}
                  stats={stats}
                  onSwitchTab={setTab}
                />
              )}
              {tab === "bookings" && (
                <>
                  <BookingsTab
                    upcomingBookings={showHistory ? [] : upcomingBookings}
                    recentBookings={showHistory ? [] : recentBookings}
                    historyBookings={showHistory ? historyBookings : []}
                    locale={locale}
                    refundCutoffHours={refundCutoffHours}
                    onViewQr={setQrBooking}
                    onRefund={setRefundBooking}
                    onReschedule={setRescheduleBooking}
                  />
                  {(historyBookings.length > 0 || upcomingBookings.length + recentBookings.length === 0) && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      style={{ textAlign: 'center', marginTop: 20 }}
                    >
                      <button
                        type="button"
                        onClick={() => setShowHistory(!showHistory)}
                        className="group"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 8,
                          background: showHistory ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.06)',
                          border: `1px solid ${showHistory ? 'rgba(34,197,94,0.25)' : 'rgba(255,255,255,0.1)'}`,
                          color: showHistory ? GREEN : SUBTLE,
                          fontSize: 13,
                          fontWeight: 500,
                          padding: '10px 22px',
                          borderRadius: 999,
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          fontFamily: FONT_FAMILY,
                        }}
                      >
                        <History size={15} strokeWidth={2} />
                        {showHistory
                          ? `Back to active bookings`
                          : `View all ${historyBookings.length} past bookings`}
                      </button>
                    </motion.div>
                  )}
                </>
              )}
              {tab === "points" && <PointsTab points={points} balance={user.points} locale={locale} />}
              {tab === "settings" && <SettingsTab user={user} onSignOut={signOut} />}
              {tab === "access" && (
                <MemberQrGuide memberCode={user.member_code} qrDataUrl={memberQrDataUrl} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* QR modal */}
      <QrModal booking={qrBooking} memberCode={user.member_code} onClose={() => setQrBooking(null)} locale={locale} />

      {/* Refund confirmation modal */}
      <RefundConfirmModal
        booking={refundBooking}
        onClose={() => setRefundBooking(null)}
        onRefunded={(booking, result) => {
          setBookings((prev) =>
            prev.map((b) =>
              b.id === booking.id
                ? { ...b, status: "refunded", refundAmount: result.refundAmount, refundFee: result.refundFee }
                : b,
            ),
          );
          setRefundBooking(null);
        }}
      />

      {/* Reschedule picker */}
      <ReschedulePicker
        booking={rescheduleBooking}
        onClose={() => setRescheduleBooking(null)}
        onRescheduled={(booking, result) => {
          setBookings((prev) =>
            prev.map((b) =>
              b.id === booking.id
                ? {
                    ...b,
                    date: result.date,
                    startTime: result.startTime,
                    endTime: result.endTime,
                    tableId: result.tableNumber,
                    rescheduleCount: result.rescheduleCount,
                  }
                : b,
            ),
          );
          setRescheduleBooking(null);
        }}
      />
    </div>
  );
}

/* ── Small presentational helpers ── */
function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="font-label" style={{ fontSize: "10px", color: SUBTLE }}>{children}</span>;
}

function DashboardHeader({ displayName, notifOpen, setNotifOpen, notifications, unreadCount, markAllRead }: {
  displayName: string | null;
  notifOpen: boolean;
  setNotifOpen: (v: boolean) => void;
  notifications: Array<{ id: string; type: string; message: string; read: boolean; created_at: string }>;
  unreadCount: number;
  markAllRead: () => void;
}) {
  const t = useTranslations("memberPage");
  const locale = useLocale();
  const router = useRouter();

  const LOCALES = ["zh-HK", "zh-CN", "en"] as const;
  const LABELS: Record<string, string> = { "zh-HK": "繁", "zh-CN": "简", en: "EN" };

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
        padding: "16px 20px 16px 72px",
        background: "rgba(0,0,0,0.72)",
        backdropFilter: "blur(20px) saturate(160%)",
        WebkitBackdropFilter: "blur(20px) saturate(160%)",
        borderBottom: `1px solid ${BORDER}`,
      }}
    >
      {/* Left side intentionally empty — BackButton is a separate fixed
          element (this header's left padding already reserves space for it).
          Greeting + language switcher — separated with real breathing room,
          language toggle styled as its own frosted glass pill (matches the
          public Nav's pill container recipe) rather than a flat text box. */}
      <div />
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        <span style={{ fontSize: "14px", color: SUBTLE }}>
          {t("greeting")}{displayName ? `, ${displayName}` : ""}
        </span>
        {/* Notification bell */}
        <button
          type="button"
          onClick={() => setNotifOpen(!notifOpen)}
          aria-label={`Notifications (${unreadCount} unread)`}
          style={{
            position: 'relative',
            width: 40, height: 40, borderRadius: '50%',
            border: `1px solid ${HAIRLINE}`,
            background: notifOpen ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.05)',
            color: notifOpen ? GREEN : SUBTLE,
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Bell size={17} strokeWidth={2} />
          {unreadCount > 0 && (
            <span style={{
              position: 'absolute', top: -2, right: -2,
              width: 18, height: 18, borderRadius: '50%',
              background: DANGER, color: '#fff',
              fontSize: 10, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {unreadCount}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={cycleLocale}
          aria-label="Switch language"
          style={{
            color: INK,
            fontSize: "13px",
            fontWeight: 500,
            background: "rgba(255,255,255,0.05)",
            backdropFilter: "blur(24px) saturate(180%)",
            WebkitBackdropFilter: "blur(24px) saturate(180%)",
            border: `1px solid ${HAIRLINE}`,
            borderRadius: "999px",
            padding: "8px 14px",
            cursor: "pointer",
            minHeight: 36,
          }}
        >
          {LABELS[locale] ?? "中"}
        </button>
      </div>

      {/* Notification dropdown */}
      <AnimatePresence>
        {notifOpen && (
          <>
            <div
              onClick={() => setNotifOpen(false)}
              style={{ position: 'fixed', inset: 0, zIndex: 50 }}
            />
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              transition={{ duration: 0.2, ease: EASE }}
              style={{
                position: 'absolute',
                top: '100%',
                right: 20,
                zIndex: 51,
                width: 360,
                maxHeight: 400,
                overflowY: 'auto',
                background: DEEP,
                border: `1px solid ${HAIRLINE}`,
                borderRadius: 20,
                padding: '8px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px 8px' }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: INK }}>Notifications</span>
                {notifications.length > 0 && (
                  <button
                    type="button"
                    onClick={markAllRead}
                    style={{ background: 'none', border: 'none', color: GREEN, fontSize: 12, cursor: 'pointer' }}
                  >
                    Mark all read
                  </button>
                )}
              </div>
              {notifications.length === 0 ? (
                <div style={{ padding: '20px 14px', textAlign: 'center', color: SUBTLE, fontSize: 13 }}>
                  No notifications yet
                </div>
              ) : (
                notifications.slice(0, 10).map((n) => (
                  <div
                    key={n.id}
                    style={{
                      display: 'flex', gap: 10, padding: '12px 14px',
                      borderRadius: 12,
                      background: n.read ? 'transparent' : 'rgba(34,197,94,0.06)',
                      borderBottom: `1px solid ${BORDER}`,
                    }}
                  >
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%', marginTop: 5, flexShrink: 0,
                      background: n.read ? 'transparent' : GREEN,
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: n.read ? SUBTLE : INK, lineHeight: 1.4 }}>
                        {n.message}
                      </div>
                      <div style={{ fontSize: 11, color: SUBTLE, marginTop: 4 }}>
                        {new Date(n.created_at).toLocaleString()}
                      </div>
                    </div>
                    {!n.read && (
                      <Check size={14} color={GREEN} style={{ flexShrink: 0, marginTop: 3, opacity: 0.5 }} />
                    )}
                  </div>
                ))
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </header>
  );
}

function StatCard({ label, value, unit, last }: { label: string; value: string; unit?: string; last?: boolean }) {
  return (
    <div
      style={{
        borderRight: last ? "none" : `1px solid ${BORDER}`,
        padding: "0 16px",
        textAlign: "center",
      }}
    >
      <div style={{ fontFamily: DISPLAY, fontSize: "30px", letterSpacing: "0.02em", color: INK, lineHeight: 1 }}>
        {value}
        {unit ? <span style={{ fontSize: "12px", color: SUBTLE, marginLeft: "3px", fontFamily: FONT_FAMILY, fontWeight: 400 }}>{unit}</span> : null}
      </div>
      <div style={{ fontSize: "12px", color: SUBTLE, marginTop: "8px" }}>{label}</div>
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
    refunded: { label: t("status_refunded"), color: DANGER },
    pending: { label: t("status_pending"), color: SUBTLE },
    payment_failed: { label: t("status_payment_failed"), color: DANGER },
  };
  // Unknown statuses used to silently render as "Confirmed" (the old
  // fallback) — fall back to the neutral "Pending" look instead, since an
  // unrecognized status is more likely a new/incomplete state than a
  // confirmed one.
  const s = map[status] ?? map.pending;
  return (
    <span style={{ fontSize: "12px", fontWeight: 600, color: s.color, background: `${s.color}1f`, borderRadius: "100px", padding: "3px 10px" }}>
      {s.label}
    </span>
  );
}

// bookings.start_time is a bare Postgres `time` ("HH:MM:SS"), not a full
// timestamp — anchor it to the booking's date for real "now vs start" math.
// (Confirmed by getMemberTicket's parseInt(startTime.slice(0,2)) usage.)
function bookingStart(b: MemberBooking): Date | null {
  if (!b.date || !b.startTime) return null;
  const time = b.startTime.length > 8 ? b.startTime.slice(11, 19) : b.startTime;
  const d = new Date(`${b.date}T${time}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function canRefund(b: MemberBooking, refundCutoffHours: number): boolean {
  if (b.status !== "confirmed") return false;
  const start = bookingStart(b);
  if (!start) return false;
  return Date.now() < start.getTime() - refundCutoffHours * 3600_000;
}

function canReschedule(b: MemberBooking): boolean {
  if (b.status !== "confirmed") return false;
  const start = bookingStart(b);
  if (!start) return false;
  return Date.now() < start.getTime();
}

// The entry QR is only useful while the slot can still be entered — once the
// booking has ended (or was cancelled/refunded) the code would never scan, so
// hide the button instead of offering a dead QR.
function bookingEnd(b: MemberBooking): Date | null {
  if (!b.date || !b.endTime) return null;
  const time = b.endTime.length > 8 ? b.endTime.slice(11, 19) : b.endTime;
  const d = new Date(`${b.date}T${time}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function canShowQr(b: MemberBooking): boolean {
  if (b.status !== "confirmed") return false;
  const end = bookingEnd(b);
  // No parseable end time — keep the QR visible rather than hiding a
  // potentially valid ticket.
  if (!end) return true;
  return Date.now() < end.getTime();
}

/* ── Overview Tab — first-time landing, card + stats in compact view ── */
function OverviewTab({
  user, tierId, accent, progress, pointsToNext, next, current,
  memberQrDataUrl, stats, onSwitchTab,
}: {
  user: MemberData['user']; tierId: string; accent: string; progress: number;
  pointsToNext: number; next: Tier | null; current: Tier;
  memberQrDataUrl: string | null; stats: { bookings: number; hours: number };
  onSwitchTab: (tab: TabId) => void;
}) {
  const t = useTranslations('memberPage');

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE }}
    >
      {/* Quick actions row */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 20,
      }}>
        <QuickActionCard
          icon={<Zap size={18} strokeWidth={2} />}
          label={t('stat_bookings')}
          value={`${stats.bookings}`}
          accent={GREEN}
          onClick={() => onSwitchTab('bookings')}
        />
        <QuickActionCard
          icon={<Coins size={18} strokeWidth={2} />}
          label={t('card_points')}
          value={`${user.points.toLocaleString()} pts`}
          accent={accent}
          onClick={() => onSwitchTab('points')}
        />
      </div>

      {/* Tier progress condensed */}
      <div style={{
        border: `1px solid ${BORDER}`, borderRadius: 16, padding: 18,
        background: GLASS_BG, marginBottom: 16,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span className="font-code" style={{ fontSize: 13, fontWeight: 600, color: accent }}>
            {TIER_TITLE[tierId] ?? tierId}
          </span>
          {next && (
            <span style={{ fontSize: 11, color: SUBTLE }}>
              {t('points_to_next', { pts: pointsToNext.toLocaleString() })}
            </span>
          )}
        </div>
        <div style={{ height: 4, borderRadius: 100, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.round(progress * 100)}%` }}
            transition={{ duration: 0.9, ease: EASE }}
            style={{ height: '100%', background: accent, borderRadius: 100 }}
          />
        </div>
      </div>

      {/* 暫時停用，等 Apple PEM 格式問題同 Google service account 設定好返先重開，相關 prompt：wallet-pass-refined-prompt.md */}
      {false && (
        <div style={{
        border: `1px solid ${BORDER}`, borderRadius: 16, padding: 18,
        background: GLASS_BG, marginBottom: 16,
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: INK, marginBottom: 12 }}>
          Wallet Card
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
          <WalletButton
            href="/api/wallet/apple-pass"
            label={t('add_apple_wallet')}
            icon={
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M17.05 12.97c.04 3.78 3.32 5.04 3.36 5.06-.03.09-.53 1.8-1.73 3.57-1.04 1.54-2.12 3.07-3.82 3.1-1.67.04-2.2-1.11-4.1-1.11-1.9 0-2.5 1.08-4.07 1.15-1.63.07-2.87-1.66-3.92-3.2-2.13-3.08-3.76-8.7-1.57-12.5C6.32 6.72 8.03 5.6 9.9 5.57c1.56-.03 3.03 1.1 3.99 1.1.95 0 2.74-1.36 4.62-1.16.79.03 3 .32 4.42 2.4-.11.07-2.64 1.54-2.61 4.6M12.2 5.52c.7-.84 1.17-2.01 1.04-3.17-.1-.01-2.12.04-3.9 1.63-.65.53-1.2 1.37-1.26 2.6-.07.01 2.38.18 4.12-1.06Z"/>
              </svg>
            }
          />
          <WalletButton
            href="/api/wallet/google-pass"
            label={t('add_google_wallet')}
            icon={
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M22.17 12.57c0-.53-.05-1.04-.14-1.53H12.3v2.9h5.56a3.45 3.45 0 0 1-1.5 2.26v1.88h2.42c1.42-1.31 2.24-3.24 2.24-5.51Z"/>
                <path d="M12.3 22.3c2.04 0 3.75-.67 5-1.82l-2.43-1.88c-.68.46-1.55.72-2.57.72-1.97 0-3.64-1.33-4.24-3.12H5.57v1.94A7.55 7.55 0 0 0 12.3 22.3Z"/>
                <path d="M8.06 16.2a4.55 4.55 0 0 1-.24-1.46c0-.5.09-1 .24-1.46V11.34H5.57a7.55 7.55 0 0 0 0 6.8l2.49-1.94Z"/>
                <path d="M12.3 7.78c1.11 0 2.1.38 2.88 1.13l2.16-2.16C16.04 5.22 14.34 4.5 12.3 4.5a7.55 7.55 0 0 0-6.73 4.17l2.49 1.94c.6-1.8 2.27-3.12 4.24-3.12Z"/>
              </svg>
            }
          />
        </div>
        </div>
      )}
    </motion.div>
  );
}

function QuickActionCard({ icon, label, value, accent, onClick }: {
  icon: React.ReactNode; label: string; value: string; accent: string; onClick?: () => void;
}) {
  const t = useTranslations("memberPage");
  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter") onClick(); } : undefined}
      style={{
        border: `1px solid ${BORDER}`, borderRadius: 14, padding: 16,
        background: GLASS_BG, cursor: onClick ? "pointer" : "default",
        transition: "all 0.2s ease",
      }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: '50%',
        background: `${accent}1f`, color: accent,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 10,
      }}>
        {icon}
      </div>
      <div style={{ fontSize: 12, color: SUBTLE, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: INK }}>
        {value || '—'}
      </div>
      {onClick && (
        <div style={{ fontSize: 12, color: GREEN, marginTop: 8, display: "flex", alignItems: "center", gap: 2 }}>
          {t("quick_view_details")}
          <span aria-hidden="true">→</span>
        </div>
      )}
    </div>
  );
}

// Button that streams the pass download (Apple: .pkpass buffer; Google:
// redirect to pay.google.com save endpoint). Both are GET navigation, so a
// plain anchor keeps the member signed in (cookie) and starts the download.
function WalletButton({ href, label, icon }: { href: string; label: string; icon: React.ReactNode }) {
  return (
    <a
      href={href}
      data-cms-key={`member.${label}`}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        gap: 8, minHeight: 44, padding: '0 12px', borderRadius: 12,
        border: `1px solid ${BORDER}`, background: 'rgba(255,255,255,0.05)',
        color: INK, fontSize: 13, fontWeight: 600, cursor: 'pointer',
        textDecoration: 'none', fontFamily: FONT_FAMILY,
      }}
    >
      {icon}
      {label}
    </a>
  );
}

function BookingsTab({
  upcomingBookings,
  recentBookings,
  historyBookings,
  locale,
  refundCutoffHours,
  onViewQr,
  onRefund,
  onReschedule,
}: {
  upcomingBookings: MemberBooking[];
  recentBookings: MemberBooking[];
  historyBookings: MemberBooking[];
  locale: string;
  refundCutoffHours: number;
  onViewQr: (b: MemberBooking) => void;
  onRefund: (b: MemberBooking) => void;
  onReschedule: (b: MemberBooking) => void;
}) {
  const t = useTranslations("memberPage");
  const router = useRouter();

  const allEmpty = upcomingBookings.length === 0 && recentBookings.length === 0 && historyBookings.length === 0
  if (allEmpty) {
    return (
      <div style={{ textAlign: "center", padding: "48px 24px" }}>
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <div
            style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'rgba(34,197,94,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px',
            }}
          >
            <Ticket size={24} strokeWidth={1.5} color={GREEN} />
          </div>
          <div style={{ fontSize: "16px", fontWeight: 600, color: INK, marginBottom: 6 }}>
            {t("no_bookings_title") || "No bookings yet"}
          </div>
          <div style={{ fontSize: "14px", color: SUBTLE, maxWidth: 280, margin: '0 auto', lineHeight: 1.5 }}>
            {t("no_bookings_desc") || "When you make a booking, it'll appear here. Ready to play?"}
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {upcomingBookings.length > 0 && (
        <BookingSection
          title={t("section_upcoming") || "Upcoming"}
          subtitle={t("section_upcoming_desc") || "Your confirmed future bookings"}
          icon={<Zap size={14} strokeWidth={2} />}
          bookings={upcomingBookings}
          locale={locale}
          refundCutoffHours={refundCutoffHours}
          onViewQr={onViewQr}
          onRefund={onRefund}
          onReschedule={onReschedule}
        />
      )}
      {recentBookings.length > 0 && (
        <BookingSection
          title={t("section_recent") || "Recent"}
          subtitle={t("section_recent_desc") || `Last ${RECENT_DAYS} days`}
          icon={<Clock size={14} strokeWidth={2} />}
          bookings={recentBookings}
          locale={locale}
          refundCutoffHours={refundCutoffHours}
          onViewQr={onViewQr}
          onRefund={onRefund}
          onReschedule={onReschedule}
        />
      )}
      {historyBookings.length > 0 && (
        <BookingSection
          title={t("section_history") || "History"}
          subtitle={`${historyBookings.length} booking${historyBookings.length !== 1 ? 's' : ''}`}
          icon={<History size={14} strokeWidth={2} />}
          bookings={historyBookings}
          locale={locale}
          refundCutoffHours={refundCutoffHours}
          onViewQr={onViewQr}
          onRefund={onRefund}
          onReschedule={onReschedule}
          muted
        />
      )}
    </div>
  );
}

function BookingSection({
  title, subtitle, icon, bookings, locale, refundCutoffHours, onViewQr, onRefund, onReschedule, muted,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  bookings: MemberBooking[];
  locale: string;
  refundCutoffHours: number;
  onViewQr: (b: MemberBooking) => void;
  onRefund: (b: MemberBooking) => void;
  onReschedule: (b: MemberBooking) => void;
  muted?: boolean;
}) {
  const t = useTranslations("memberPage");
  const router = useRouter();

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Section header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{
          width: 24, height: 24, borderRadius: '50%',
          background: muted ? 'rgba(255,255,255,0.05)' : 'rgba(34,197,94,0.12)',
          color: muted ? SUBTLE : GREEN,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          {icon}
        </span>
        <div>
          <span style={{ fontSize: 13, fontWeight: 600, color: muted ? SUBTLE : INK, letterSpacing: '0.02em' }}>
            {title}
          </span>
          <span style={{ fontSize: 11, color: SUBTLE, marginLeft: 8 }}>{subtitle}</span>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {bookings.map((b) => (
          <div
            key={b.id}
            onClick={() => router.push(`/member/bookings/${b.id}`)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter") router.push(`/member/bookings/${b.id}`);
            }}
            style={{
              border: `1px solid ${BORDER}`,
              borderRadius: "16px",
              padding: "18px",
              cursor: "pointer",
              background: GLASS_BG,
              backdropFilter: GLASS_BLUR,
              WebkitBackdropFilter: GLASS_BLUR,
              opacity: muted ? 0.65 : 1,
              transition: 'all 0.2s ease',
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
              <div>
                <div style={{ fontSize: "16px", fontWeight: 600, color: muted ? SUBTLE : INK }}>
                  {formatDate(b.date, locale)}
                </div>
                <div style={{ fontSize: "14px", color: SUBTLE, marginTop: "2px" }}>
                  {b.startTime?.slice(11, 16) || b.startTime || "—"}
                  {b.endTime ? ` – ${b.endTime.slice(11, 16) || b.endTime}` : ""}
                  {b.tableId ? ` · ${t("booking_table")} ${b.tableId}` : ""}
                </div>
                <div style={{ fontSize: "14px", color: SUBTLE, marginTop: "2px" }}>
                  {b.durationHours ? `${b.durationHours}h · ` : ""}HK${b.price}
                </div>
                {b.status === "refunded" && b.refundAmount != null && (
                  <div style={{ fontSize: "13px", color: SUBTLE, marginTop: "2px" }}>
                    {t("refund_success_toast")} HK${b.refundAmount}
                  </div>
                )}
              </div>
              <StatusBadge status={b.status} />
            </div>
            {!muted && (
              <div
                style={{ display: "flex", gap: "10px", marginTop: "16px", alignItems: "center" }}
                onClick={(e) => e.stopPropagation()}
              >
                {b.status === "payment_failed" ? (
                  retryPaymentLink(b) && (
                    <SmallButton
                      onClick={() => router.push(retryPaymentLink(b)!)}
                      icon={<RotateCw size={15} strokeWidth={2} />}
                      label={t("booking_retry_payment")}
                      cmsKey="member.booking_retry_payment"
                      primary
                    />
                  )
                ) : (
                  canShowQr(b) && (
                    <SmallButton
                      onClick={() => onViewQr(b)}
                      icon={<QrCodeIcon size={15} strokeWidth={2} />}
                      label={t("booking_view_qr")}
                      cmsKey="member.booking_view_qr"
                      primary
                    />
                  )
                )}
                {canRefund(b, refundCutoffHours) && (
                  <SmallButton
                    onClick={() => onRefund(b)}
                    icon={<Undo2 size={15} strokeWidth={2} />}
                    label={t("booking_refund")}
                    cmsKey="member.booking_refund"
                    tone="danger"
                  />
                )}
                <div style={{ marginLeft: "auto" }}>
                  <OverflowMenu
                    items={[
                      { label: t("booking_add_calendar"), icon: <CalendarPlus size={15} strokeWidth={2} />, href: calendarLink(b) },
                      ...(canReschedule(b)
                        ? [{ label: t("booking_reschedule"), icon: <CalendarClock size={15} strokeWidth={2} />, onClick: () => onReschedule(b) }]
                        : []),
                    ]}
                    ariaLabel={t("booking_more_actions")}
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </motion.section>
  );
}

// Icon + tint per points_ledger category — mirrors StatusBadge's
// ${color}1f-tinted-circle convention.
const POINTS_CATEGORY_STYLE: Record<
  import("@/lib/data/getMember").PointsEntry["category"],
  { icon: React.ReactNode; color: string }
> = {
  booking: { icon: <CalendarPlus size={14} strokeWidth={2} />, color: GREEN },
  refund: { icon: <Undo2 size={14} strokeWidth={2} />, color: DANGER },
  manual: { icon: <Sparkles size={14} strokeWidth={2} />, color: SUBTLE },
};

function PointsTab({ points, balance, locale }: { points: import("@/lib/data/getMember").PointsEntry[]; balance: number; locale: string }) {
  const t = useTranslations("memberPage");
  const earn = t.raw("points_earn") as string[];
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "16px" }}>
        <span style={{ fontSize: "14px", color: SUBTLE }} data-cms-key="member.points_running_total">{t("points_running_total")}</span>
        <span style={{ fontFamily: DISPLAY, fontSize: "30px", color: INK, letterSpacing: "0.02em" }}>{balance.toLocaleString()} <span style={{ fontSize: "13px", color: SUBTLE, fontFamily: FONT_FAMILY }}>pts</span></span>
      </div>

      {points.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {points.map((p, i) => {
            const iconStyle = POINTS_CATEGORY_STYLE[p.category];
            return (
              <div
                key={p.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "16px 0",
                  borderBottom: i < points.length - 1 ? `1px solid ${BORDER}` : "none",
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    flexShrink: 0,
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    background: `${iconStyle.color}1f`,
                    color: iconStyle.color,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {iconStyle.icon}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "15px", color: INK }}>{p.description || "—"}</div>
                  <div style={{ fontSize: "12px", color: SUBTLE, marginTop: "2px" }}>{formatDate(p.date, locale)}</div>
                </div>
                <span
                  style={{
                    fontSize: "16px",
                    fontWeight: 700,
                    color: p.delta >= 0 ? GREEN : DANGER,
                    minWidth: "64px",
                    textAlign: "right",
                    flexShrink: 0,
                  }}
                >
                  {p.delta >= 0 ? "+" : ""}
                  {p.delta}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState text={t("no_points")} />
      )}

      {/* Earn ways */}
      <div style={{ marginTop: "32px", border: `1px solid ${BORDER}`, borderRadius: "16px", padding: "20px" }}>
        <h4 style={{ fontSize: "14px", fontWeight: 600, margin: "0 0 14px", color: INK }} data-cms-key="member.points_earn_title">{t("points_earn_title")}</h4>
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "10px" }}>
          {earn.map((e, i) => (
            <li key={e} style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "14px", color: "rgba(244,241,234,0.75)" }} data-cms-key={`member.points_earn.${i}`}>
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
  const [saveError, setSaveError] = useState<string | null>(null);
  const [notif, setNotif] = useState({ booking: true, points: true, promo: false });

  const toggleNotif = async (key: 'booking' | 'points' | 'promo', value: boolean) => {
    setNotif((s) => ({ ...s, [key]: value }));
    try {
      await fetch('/api/profile/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notif_prefs: { ...notif, [key]: value } }),
      });
    } catch {}
  };

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      // Validated server save (service-role) — mirrors the mandatory profile gate
      // so a clean +852 number can't be overwritten with junk, and a failure is
      // surfaced rather than swallowed (the old client .update() failed silently).
      const res = await fetch("/api/profile/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setSaveError(
          j.field === "name"
            ? t("settings_err_name")
            : j.field === "phone"
              ? t("settings_err_phone")
              : t("settings_err_generic"),
        );
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setSaveError(t("settings_err_generic"));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = () => {
    if (window.confirm(t("delete_confirm"))) {
      // Deletion requires a server action — redirect to support
      window.location.href = SITE_CONTACT.whatsappUrl
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    minHeight: 48,
    padding: "0 16px",
    borderRadius: "12px",
    border: `1px solid ${BORDER}`,
    background: "rgba(0,0,0,0.25)",
    color: INK,
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
      <div style={{ border: `1px solid ${BORDER}`, borderRadius: "16px", padding: "20px" }}>
        <h4 style={{ fontSize: "14px", fontWeight: 600, margin: "0 0 16px", color: INK }} data-cms-key="member.settings_notifications">{t("settings_notifications")}</h4>
        <Toggle label={t("notif_booking")} on={notif.booking} onChange={(v) => toggleNotif('booking', v)} />
        <Toggle label={t("notif_points")} on={notif.points} onChange={(v) => toggleNotif('points', v)} />
        <Toggle label={t("notif_promo")} on={notif.promo} onChange={(v) => toggleNotif('promo', v)} last />
      </div>

      {saveError && (
        <p data-cms-key="member.settings_error" style={{ fontSize: "13px", color: DANGER, margin: 0 }}>
          {saveError}
        </p>
      )}

      <button
        type="button"
        onClick={save}
        disabled={saving}
        style={{
          minHeight: 52,
          borderRadius: "14px",
          border: "none",
          background: GREEN,
          color: DEEP,
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
        style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px", minHeight: 48, borderRadius: "12px", border: `1px solid ${BORDER}`, background: "transparent", color: DANGER, fontSize: "15px", fontWeight: 600, cursor: "pointer" }}
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
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: last ? "none" : `1px solid ${BORDER}` }}>
      <span style={{ fontSize: "15px", color: INK }}>{label}</span>
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
  primary,
  tone,
}: {
  label: string;
  icon: React.ReactNode;
  onClick?: () => void;
  href?: string;
  cmsKey: string;
  /** Visually the hero action on the card (filled/tinted pill). */
  primary?: boolean;
  /** Outline-only, tinted text — for a visible-but-de-emphasized action. */
  tone?: "danger";
}) {
  const toneColor = tone === "danger" ? DANGER : INK;
  const style: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    minHeight: 40,
    padding: "0 14px",
    borderRadius: "100px",
    border: `1px solid ${primary ? GREEN : tone === "danger" ? `${DANGER}55` : BORDER}`,
    background: primary ? `${GREEN}1f` : "rgba(255,255,255,0.05)",
    backdropFilter: "blur(20px) saturate(180%)",
    WebkitBackdropFilter: "blur(20px) saturate(180%)",
    color: primary ? GREEN : toneColor,
    fontSize: "13px",
    fontWeight: primary ? 600 : 500,
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

type OverflowMenuItem = {
  label: string;
  icon: React.ReactNode;
  onClick?: () => void;
  href?: string;
};

// Small anchored popover for low-frequency secondary actions — same
// AnimatePresence + SPRING recipe as QrModal, but a compact dropdown instead
// of a full-screen overlay.
function OverflowMenu({ items, ariaLabel }: { items: OverflowMenuItem[]; ariaLabel: string }) {
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;
  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        style={{
          width: 40,
          height: 40,
          borderRadius: "50%",
          border: `1px solid ${BORDER}`,
          background: "transparent",
          color: SUBTLE,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "18px",
          lineHeight: 1,
        }}
      >
        ⋯
      </button>
      <AnimatePresence>
        {open && (
          <>
            {/* Click-outside catcher */}
            <div
              onClick={() => setOpen(false)}
              style={{ position: "fixed", inset: 0, zIndex: 90 }}
            />
            <motion.div
              role="menu"
              initial={{ opacity: 0, scale: 0.95, y: -6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -6 }}
              transition={SPRING}
              style={{
                position: "absolute",
                top: "calc(100% + 6px)",
                right: 0,
                zIndex: 91,
                minWidth: 180,
                background: DEEP,
                border: `1px solid ${HAIRLINE}`,
                borderRadius: "14px",
                padding: "6px",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {items.map((item, i) => {
                const itemStyle: React.CSSProperties = {
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "10px 12px",
                  borderRadius: "9px",
                  border: "none",
                  background: "transparent",
                  color: INK,
                  fontSize: "14px",
                  fontFamily: FONT_FAMILY,
                  cursor: "pointer",
                  textAlign: "left",
                  textDecoration: "none",
                };
                return item.href ? (
                  <a key={i} href={item.href} download role="menuitem" style={itemStyle} onClick={() => setOpen(false)}>
                    {item.icon}
                    {item.label}
                  </a>
                ) : (
                  <button
                    key={i}
                    type="button"
                    role="menuitem"
                    style={itemStyle}
                    onClick={() => {
                      setOpen(false);
                      item.onClick?.();
                    }}
                  >
                    {item.icon}
                    {item.label}
                  </button>
                );
              })}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div style={{ textAlign: "center", padding: "48px 24px", color: SUBTLE, fontSize: "15px" }}>{text}</div>
  );
}

function QrModal({ booking, memberCode, onClose, locale }: { booking: MemberBooking | null; memberCode: string; onClose: () => void; locale: string }) {
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
            style={{ position: "relative", width: "100%", maxWidth: "360px", background: DEEP, border: `1px solid ${HAIRLINE}`, borderRadius: "24px", padding: "32px", textAlign: "center", fontFamily: FONT_FAMILY }}
          >
            <button type="button" onClick={onClose} aria-label={t("close")} style={{ position: "absolute", top: "16px", right: "16px", width: "36px", height: "36px", borderRadius: "50%", border: "none", background: "rgba(255,255,255,0.1)", color: INK, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <X size={18} />
            </button>
            <h3 style={{ fontFamily: DISPLAY, fontSize: "24px", letterSpacing: "0.04em", margin: "0 0 20px", color: INK }} data-cms-key="member.qr_modal_title">
              {t("qr_modal_title")}
            </h3>
            <div style={{ display: "flex", justifyContent: "center", padding: "20px", background: "white", borderRadius: "16px" }}>
              <QRCode data={memberCode} size={200} enlargeLabel={t("qr_tap_enlarge")} closeLabel={t("close")} />
            </div>
            <div style={{ marginTop: "20px" }}>
              <div className="font-label" style={{ fontSize: "12px", color: SUBTLE }} data-cms-key="member.qr_reference">
                {t("qr_reference")}
              </div>
              <div style={{ fontSize: "16px", fontWeight: 700, fontFamily: "ui-monospace, monospace", marginTop: "4px", color: INK }}>
                {booking.humanCode}
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
  const title = encodeURIComponent("Space8");
  const toCal = (iso: string | null) => (iso ? iso.replace(/[-:]/g, "").replace(/\.\d+/, "") : "");
  const start = toCal(b.startTime);
  const end = toCal(b.endTime);
  const dates = start && end ? `&dates=${start}/${end}` : "";
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}${dates}`;
}

// A payment_failed booking's original slot lock is long gone (locks expire
// in minutes, this can be found much later) — retry can't resume the same
// booking row, only send the user back into slot selection with the same
// date/time/table/duration pre-filled via /book's existing prefill effect.
// Availability isn't re-checked here on purpose, same as that effect's own
// prefill path — Screen1 handles a since-taken slot the same way either way.
function retryPaymentLink(b: MemberBooking): string | null {
  if (!b.date || !b.startTime || !b.tableId) return null;
  const hour = b.startTime.length > 8 ? b.startTime.slice(11, 13) : b.startTime.slice(0, 2);
  const start = parseInt(hour, 10);
  if (Number.isNaN(start)) return null;
  const params = new URLSearchParams({
    date: b.date,
    start: String(start),
    duration: String(b.durationHours || 1),
    table: String(b.tableId),
  });
  return `/book?${params.toString()}`;
}
