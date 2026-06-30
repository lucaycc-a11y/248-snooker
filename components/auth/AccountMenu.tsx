"use client"

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react"
import { createPortal } from "react-dom"
import { motion, AnimatePresence } from "framer-motion"
import { User, LogOut, UserCircle, Settings } from "lucide-react"
import { useTranslations } from "next-intl"
import { useRouter } from "@/i18n/navigation"
import { createClient } from "@/lib/supabase/client"

const GREEN = "#22c55e"
// Dark-glass surface for floating menus (readable over arbitrary content),
// matching the landing nav's blur+saturate treatment.
const GLASS_BG = "rgba(12,12,14,0.82)"
const GLASS_BLUR = "blur(20px) saturate(180%)"
const GLASS_BORDER = "1px solid rgba(255,255,255,0.12)"
// Tier accents match the landing membership section: green / amber / purple.
const TIER_ACCENT: Record<string, string> = {
  amateur: "#22C55E",
  century: "#F59E0B",
  maximum: "#A78BFA",
}

const menuItemStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "13px 18px",
  fontSize: 15,
  color: "#fff",
  textDecoration: "none",
  background: "none",
  border: "none",
  textAlign: "left",
  font: "inherit",
}

/**
 * Account menu for the navbar avatar. Tap opens a dropdown (desktop) or bottom
 * sheet (mobile); on mobile the avatar pill also supports swipe-left to reveal a
 * quick Sign Out (secondary fast path — the tap menu is the full option). Sign
 * out awaits signOut() then push('/') + refresh() to clear server-rendered
 * session state, surfacing an error rather than failing silently.
 *
 * Portaled to <body> because the nav uses transform: scale() on scroll, which
 * would otherwise make position:fixed children anchor to the nav, not the viewport.
 */
export function AccountMenu({
  avatarUrl,
  variant,
  linkColor = "#fff",
}: {
  avatarUrl: string | null
  variant: "desktop" | "mobile"
  linkColor?: string
}) {
  const t = useTranslations("nav")
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [profile, setProfile] = useState<{ name: string | null; tier: string | null }>({
    name: null,
    tier: null,
  })
  const [anchor, setAnchor] = useState<{ top: number; right: number } | null>(null)
  const [swipeRevealed, setSwipeRevealed] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => setMounted(true), [])

  // Name + tier for the menu header.
  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user || cancelled) return
      const { data } = await supabase
        .from("users")
        .select("display_name, tier")
        .eq("id", user.id)
        .maybeSingle()
      if (cancelled) return
      setProfile({
        name: data?.display_name ?? (user.user_metadata?.full_name as string | undefined) ?? null,
        tier: data?.tier ?? null,
      })
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  const openMenu = () => {
    if (triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect()
      setAnchor({ top: r.bottom + 10, right: Math.max(12, window.innerWidth - r.right) })
    }
    setOpen(true)
  }

  const signOut = useCallback(async () => {
    setSigningOut(true)
    setError(null)
    try {
      const supabase = createClient()
      const { error: e } = await supabase.auth.signOut()
      if (e) throw e
      setOpen(false)
      setSwipeRevealed(false)
      router.push("/")
      router.refresh()
    } catch {
      setError(t("sign_out_error"))
      setSigningOut(false)
    }
  }, [router, t])

  const tierAccent = profile.tier ? TIER_ACCENT[profile.tier] ?? GREEN : GREEN

  const avatar = (size = 18) =>
    avatarUrl ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt=""
        style={{ width: size + 16, height: size + 16, borderRadius: "50%", objectFit: "cover" }}
      />
    ) : (
      <User size={size} strokeWidth={1.7} />
    )

  const menuItems = (
    <>
      <div style={{ padding: "16px 18px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>{profile.name ?? "—"}</div>
        {profile.tier && (
          <div
            style={{
              marginTop: 4,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: tierAccent,
            }}
          >
            {profile.tier}
          </div>
        )}
      </div>
      {/* Plain <a>: /member is a non-localized route (locale-aware Link would 404). */}
      <a href="/member" style={menuItemStyle} role="menuitem" data-cms-key="nav.my_account">
        <UserCircle size={17} /> {t("my_account")}
      </a>
      <a href="/member?tab=settings" style={menuItemStyle} role="menuitem" data-cms-key="nav.settings">
        <Settings size={17} /> {t("settings")}
      </a>
      <div style={{ height: 1, background: "rgba(255,255,255,0.08)", margin: "6px 0" }} />
      <button
        type="button"
        onClick={signOut}
        disabled={signingOut}
        role="menuitem"
        data-cms-key="nav.sign_out"
        style={{ ...menuItemStyle, width: "100%", color: "#f87171", cursor: signingOut ? "default" : "pointer" }}
      >
        <LogOut size={17} /> {signingOut ? t("signing_out") : t("sign_out")}
      </button>
      {error && <p style={{ padding: "0 18px 12px", fontSize: 12, color: "#f87171" }}>{error}</p>}
    </>
  )

  const pill: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: variant === "desktop" ? 52 : 46,
    height: variant === "desktop" ? 52 : 46,
    borderRadius: 999,
    border: "none",
    background: "rgba(255,255,255,0.1)",
    color: linkColor,
    cursor: "pointer",
    overflow: "hidden",
  }

  const trigger =
    variant === "mobile" ? (
      <div style={{ position: "relative", width: 46, height: 46 }}>
        {/* Revealed-on-swipe quick Sign Out (secondary path). */}
        <button
          type="button"
          onClick={signOut}
          aria-label={t("sign_out")}
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#7f1d1d",
            color: "#fff",
            border: "none",
            borderRadius: 999,
          }}
        >
          <LogOut size={18} />
        </button>
        <motion.button
          ref={triggerRef}
          type="button"
          drag="x"
          dragConstraints={{ left: -52, right: 0 }}
          dragElastic={0.08}
          animate={{ x: swipeRevealed ? -52 : 0 }}
          onDragEnd={(_e, info) => setSwipeRevealed(info.offset.x < -26)}
          // onTap (not onClick) is suppressed by framer after a drag gesture.
          onTap={() => {
            if (swipeRevealed) {
              setSwipeRevealed(false)
              return
            }
            openMenu()
          }}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={t("my_account")}
          style={{ ...pill, position: "absolute", inset: 0 }}
        >
          {avatar(18)}
        </motion.button>
      </div>
    ) : (
      <button
        ref={triggerRef}
        type="button"
        onClick={openMenu}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("my_account")}
        style={pill}
      >
        {avatar(20)}
      </button>
    )

  const overlay =
    mounted &&
    createPortal(
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 200,
                background: variant === "mobile" ? "rgba(0,0,0,0.5)" : "transparent",
              }}
            />
            {variant === "mobile" ? (
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 320 }}
                role="menu"
                style={{
                  position: "fixed",
                  left: 0,
                  right: 0,
                  bottom: 0,
                  zIndex: 201,
                  background: GLASS_BG,
                  backdropFilter: GLASS_BLUR,
                  WebkitBackdropFilter: GLASS_BLUR,
                  borderTop: GLASS_BORDER,
                  borderTopLeftRadius: 24,
                  borderTopRightRadius: 24,
                  paddingBottom: 24,
                }}
              >
                <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.2)", margin: "10px auto 4px" }} />
                {menuItems}
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                transition={{ duration: 0.18 }}
                role="menu"
                style={{
                  position: "fixed",
                  top: anchor?.top ?? 64,
                  right: anchor?.right ?? 16,
                  zIndex: 201,
                  width: 240,
                  background: GLASS_BG,
                  backdropFilter: GLASS_BLUR,
                  WebkitBackdropFilter: GLASS_BLUR,
                  border: GLASS_BORDER,
                  borderRadius: 16,
                  overflow: "hidden",
                }}
              >
                {menuItems}
              </motion.div>
            )}
          </>
        )}
      </AnimatePresence>,
      document.body,
    )

  return (
    <>
      {trigger}
      {overlay}
    </>
  )
}
