'use client'

import { useState, useEffect } from 'react'
import type { CSSProperties } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Menu, X, User } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link, usePathname, useRouter } from '@/i18n/navigation'
// Plain (non-localized) link for the root-level /login and /member routes. The
// next-intl Link prefixes the active locale (/en/member), which 404s since those
// routes live at the root, outside [locale].
import PlainLink from 'next/link'
import { routing } from '@/i18n/routing'
import { tokens } from '@/app/styles/tokens'
import { Logo } from '@/components/brand'
import { Button } from '@/components/ui'
import { AccountMenu } from '@/components/auth/AccountMenu'
import { AuthModal } from '@/components/auth/AuthModal'
import { createClient } from '@/lib/supabase/client'

const navItems = [
  { href: '/', key: 'home' },
  { href: '/book', key: 'book' },
  { href: '/venue', key: 'venue' },
  { href: '/about', key: 'about' },
  { href: '/blog', key: 'blog' },
  { href: '/membership', key: 'membership' },
] as const

type NavTheme = 'dark' | 'light'

const PILL_TRANSITION = 'all 0.25s ease'
const EASE = [0.16, 1, 0.3, 1] as const

function pillStyle(theme: NavTheme): CSSProperties {
  const dark = theme === 'dark'
  return {
    background: dark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.76)',
    border: `1px solid ${dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'}`,
    backdropFilter: 'blur(24px) saturate(180%)',
    WebkitBackdropFilter: 'blur(24px) saturate(180%)',
    borderRadius: 999,
    pointerEvents: 'auto',
    transition: PILL_TRANSITION,
  }
}

export default function Nav() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [loginModalOpen, setLoginModalOpen] = useState(false)
  const [theme, setTheme] = useState<NavTheme>('dark')
  const [loggedIn, setLoggedIn] = useState(false)
  // Gates the member CTA render: loggedIn defaults to false, so without this,
  // an already-logged-in visitor would flash the logged-out "登入" state for
  // one tick while getSession() is still in flight.
  const [sessionResolved, setSessionResolved] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [scrolled, setScrolled] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations('nav')

  // Locale-aware returnUrl for OAuth redirects (re-attaches locale prefix for non-default locales)
  const returnUrl = locale === routing.defaultLocale ? pathname : `/${locale}${pathname}`

  const navText = (key: string, fallback: string) => {
    const value = t.has(key) ? t(key) : fallback
    return value
  }
  const LOCALE_LABELS: Record<string, string> = {
    'zh-HK': '繁',
    'zh-CN': '简',
    en: 'EN',
  }

  const toggleLocale = () => {
    const locales = routing.locales
    const idx = locales.indexOf(locale as (typeof locales)[number])
    const next = locales[(idx + 1) % locales.length]
    router.replace(pathname, { locale: next })
  }

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data }) => {
      setLoggedIn(!!data.session)
      setAvatarUrl(data.session?.user?.user_metadata?.avatar_url ?? null)
      setSessionResolved(true)
    })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setLoggedIn(!!session)
      setAvatarUrl(session?.user?.user_metadata?.avatar_url ?? null)
      setSessionResolved(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  // OAuth-return recovery: when Supabase can't honour the requested redirectTo
  // (domain not in its allow-list) it falls back to its dashboard Site URL, so
  // the user lands on the HOMEPAGE with ?code=... instead of /auth/callback —
  // stranded mid-booking (the reported "login kicks me back to /" bug). The
  // browser client auto-exchanges that code (PKCE detectSessionInUrl), so once
  // a session exists we resume the journey the sign-in buttons stored in
  // sessionStorage (authReturnUrl, e.g. /book) instead of leaving them here.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (!params.has('code')) return
    let stored: string | null = null
    try {
      stored = sessionStorage.getItem('authReturnUrl')
    } catch {}
    if (!stored || !stored.startsWith('/') || stored.startsWith('//')) return
    const dest = stored
    const supabase = createClient()
    let done = false
    const resume = () => {
      if (done) return
      done = true
      try {
        sessionStorage.removeItem('authReturnUrl')
      } catch {}
      // Full navigation (not router.push): dest may be a non-localized root
      // route (/book restores its own wizard state from sessionStorage).
      window.location.replace(dest)
    }
    // The auto-exchange may already have completed before this effect ran.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) resume()
    })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) resume()
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const updateScrolled = () => setScrolled(window.scrollY > 12)
    updateScrolled()
    window.addEventListener('scroll', updateScrolled, { passive: true })
    return () => window.removeEventListener('scroll', updateScrolled)
  }, [])

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [menuOpen])

  useEffect(() => {
    const updateNavTheme = () => {
      const probeX = window.innerWidth / 2
      const probeY = window.innerWidth >= 768 ? 92 : 118
      const el = document.elementFromPoint(probeX, probeY)
      if (!el) return

      let target: Element | null = el
      while (target && target !== document.body) {
        const navTheme = target.getAttribute('data-nav-theme')
        if (navTheme === 'dark' || navTheme === 'light') {
          setTheme(navTheme)
          return
        }
        target = target.parentElement
      }

      const bg = window.getComputedStyle(el).backgroundColor
      const rgb = bg.match(/\d+/g)?.map(Number) ?? [0, 0, 0]
      const lum = (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000
      setTheme(lum < 128 ? 'dark' : 'light')
    }

    updateNavTheme()
    window.addEventListener('scroll', updateNavTheme, { passive: true })
    window.addEventListener('resize', updateNavTheme, { passive: true })
    return () => {
      window.removeEventListener('scroll', updateNavTheme)
      window.removeEventListener('resize', updateNavTheme)
    }
  }, [pathname])

  const linkColor = theme === 'dark' ? '#FFFFFF' : '#1A1A1A'
  const memberLabel = loggedIn ? t('member') : t('login')

  function MemberIcon({ size = 20 }: { size?: number }) {
    if (avatarUrl) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt={t('member')}
          style={{
            width: size + 16,
            height: size + 16,
            borderRadius: '50%',
            objectFit: 'cover',
          }}
        />
      )
    }

    return <User size={size} strokeWidth={1.7} />
  }

  function DesktopMemberCta() {
    // Render nothing until the session check resolves — otherwise a logged-in
    // visitor briefly sees the logged-out "登入" button before flipping to the
    // avatar, and vice versa.
    if (!sessionResolved) return null

    if (loggedIn) {
      return (
        <div
          className="nav-cta-desktop"
          style={{
            position: 'absolute',
            right: 32,
            top: '50%',
            transform: 'translateY(-50%)',
            pointerEvents: 'auto',
            display: 'none',
          }}
        >
          <AccountMenu avatarUrl={avatarUrl} variant="desktop" linkColor={linkColor} />
        </div>
      )
    }

    return (
      <button
        type="button"
        onClick={() => setLoginModalOpen(true)}
        className="nav-cta-desktop"
        style={{
          position: 'absolute',
          right: 32,
          top: '50%',
          transform: 'translateY(-50%)',
          textDecoration: 'none',
          pointerEvents: 'auto',
          display: 'none',
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
        }}
      >
        <span
          data-cms-key="nav.login-desktop"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: tokens.colors.brand,
            color: '#000',
            borderRadius: tokens.radius.pill,
            padding: '0 24px',
            fontWeight: 700,
            fontSize: 15,
            minHeight: 48,
            whiteSpace: 'nowrap',
          }}
        >
          {t('login')}
        </span>
      </button>
    )
  }

  return (
    <>
      <nav
        // Mobile: the CSS below turns this into a solid, full-width top bar
        // (content would otherwise scroll straight under the bare floating
        // logo and read as overlapping text). The surface attr drives the
        // bar's solid colour; while the menu is open it's forced dark so the
        // bar blends into the menu overlay.
        data-nav-surface={menuOpen ? 'dark' : theme}
        style={{
          position: 'fixed',
          top: 34,
          left: 0,
          right: 0,
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 14px',
          background: 'transparent',
          border: 'none',
          pointerEvents: 'none',
          transform: scrolled ? 'scale(0.96)' : 'scale(1)',
          transformOrigin: 'top center',
          transition: 'transform 0.28s cubic-bezier(0.16,1,0.3,1)',
        }}
        className="nav-bar"
      >
        <Link
          href="/"
          style={{
            position: 'absolute',
            left: 16,
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex',
            alignItems: 'center',
            pointerEvents: menuOpen ? 'none' : 'auto',
            // The nav (z-50) sits above the mobile menu overlay (z-40) so the
            // close button stays reachable — but the logo shouldn't float over
            // the menu content, so it fades out while the menu is open.
            opacity: menuOpen ? 0 : 1,
            transition: 'opacity 0.2s ease',
          }}
          className="nav-logo"
          aria-label={t('home')}
        >
          {/* Full wordmark down to 360px — it comfortably fits with room to
              spare next to the right-side login/hamburger cluster at every
              viewport ≥360px. Below that (a handful of very old/small
              phones), the wordmark's 120px brand-guideline floor would start
              crowding the right cluster, so we swap to the icon-only mark
              (secondary logo use — not bound by the wordmark's 120px rule)
              via CSS rather than shrinking the wordmark under its minimum. */}
          <span className="nav-logo-full">
            <Logo variant="full" theme={theme} size={39} />
          </span>
          <span className="nav-logo-mark">
            <Logo variant="mark" theme={theme} size={32} />
          </span>
        </Link>

        <div
          className="nav-center"
          style={{
            ...pillStyle(theme),
            display: 'none',
            alignItems: 'center',
            gap: 24,
            padding: '11px 26px',
          }}
        >
          {navItems.map((item) => {
            const active = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                data-cms-key={`nav.link.${item.key}`}
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: active ? tokens.colors.brand : linkColor,
                  textDecoration: 'none',
                  whiteSpace: 'nowrap',
                  transition: PILL_TRANSITION,
                }}
              >
                {navText(item.key, item.key === 'home' ? 'Home' : item.key)}
              </Link>
            )
          })}

          <span
            style={{
              width: 1,
              height: 14,
              background: theme === 'dark' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)',
              margin: '0 2px',
              flexShrink: 0,
            }}
          />

          <button
            onClick={toggleLocale}
            aria-label="Switch language"
            style={{
              color: linkColor,
              fontSize: 13,
              fontWeight: 500,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: 6,
              opacity: 0.7,
              transition: PILL_TRANSITION,
            }}
          >
            {LOCALE_LABELS[locale] ?? '中'}
          </button>
        </div>

        <div
          className="nav-mobile-actions"
          style={{
            position: 'absolute',
            right: 16,
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            pointerEvents: 'auto',
          }}
        >
          {/* Same session-resolved gate as DesktopMemberCta — avoids a logged-out
              flash for already-authenticated visitors. */}
          {!sessionResolved ? null : loggedIn ? (
            <AccountMenu avatarUrl={avatarUrl} variant="mobile" linkColor={linkColor} />
          ) : (
            <button
              type="button"
              onClick={() => setLoginModalOpen(true)}
              aria-label={memberLabel}
              data-cms-key="nav.login-mobile"
              style={{
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: 46,
                  padding: '0 18px',
                  borderRadius: 999,
                  background: tokens.colors.brand,
                  color: '#000',
                  fontWeight: 700,
                  fontSize: 14,
                  whiteSpace: 'nowrap',
                }}
              >
                {navText('login', 'Login')}
              </span>
            </button>
          )}

          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="nav-hamburger"
            style={{
              ...pillStyle(theme),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 50,
              height: 46,
              cursor: 'pointer',
              color: linkColor,
              padding: 0,
              WebkitTapHighlightColor: 'transparent',
            }}
            aria-label={menuOpen ? '關閉選單' : '開啟選單'}
          >
            <motion.span
              animate={{ rotate: menuOpen ? 90 : 0, opacity: menuOpen ? 0 : 1 }}
              transition={{ duration: 0.2, ease: EASE }}
              style={{ position: 'absolute', display: 'flex' }}
            >
              <Menu size={20} />
            </motion.span>
            <motion.span
              animate={{ rotate: menuOpen ? 0 : -90, opacity: menuOpen ? 1 : 0 }}
              transition={{ duration: 0.2, ease: EASE }}
              style={{ position: 'absolute', display: 'flex' }}
            >
              <X size={20} />
            </motion.span>
          </button>
        </div>

        <DesktopMemberCta />
      </nav>

      <style jsx global>{`
        /* ── Mobile: solid full-width top bar ──
           The floating transparent nav let page content scroll straight
           under the bare logo (logo + section headings visually merged).
           Below 768px the nav becomes an opaque bar pinned to the very top;
           height 64px + safe-area. Sections that need clearance get it from
           .nav-bar's own solid surface, not from per-page padding. */
        @media (max-width: 767px) {
          .nav-bar {
            top: 0 !important;
            min-height: 64px;
            padding: 10px 14px !important;
            padding-top: calc(10px + env(safe-area-inset-top, 0px)) !important;
            transform: none !important;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;
            background: #000 !important;
            /* Solid bar must swallow taps on its own surface — with the
               desktop 'none' value, content hidden under the bar would
               still receive touches. */
            pointer-events: auto !important;
          }
          .nav-bar[data-nav-surface='light'] {
            background: #f5f5f7 !important;
            border-bottom-color: rgba(0, 0, 0, 0.1) !important;
          }
        }
        /* Icon-only fallback below 360px — see comment at the nav-logo Link
           above. Default (mobile-first): wordmark shown, mark hidden. */
        .nav-logo-full {
          display: flex;
          align-items: center;
        }
        .nav-logo-mark {
          display: none;
          align-items: center;
        }
        @media (max-width: 359px) {
          .nav-logo-full {
            display: none;
          }
          .nav-logo-mark {
            display: flex;
          }
        }
        @media (min-width: 768px) {
          .nav-bar {
            top: 20px !important;
            padding: 0 32px !important;
          }
          .nav-center {
            display: flex !important;
          }
          .nav-mobile-actions {
            display: none !important;
          }
          .nav-cta-desktop {
            display: block !important;
          }
          .nav-logo {
            left: 32px !important;
          }
          /* Brand guideline v1.0 hard rule: wordmark must never render
             narrower than 120px on digital. This used to hard-set
             height:36px !important, which at the wordmark's 3.12 aspect
             ratio renders ~112px wide — 8px under the floor. Logo.tsx
             already sizes to size={39} (≈122px wide) via its own
             MIN_WIDTH clamp; min-width here is a belt-and-braces floor
             so no future CSS override can shrink it back under 120px
             regardless of what height ends up applied. */
          .nav-logo img {
            width: auto !important;
            min-width: 120px !important;
          }
        }
      `}</style>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 40,
              // Near-opaque: the menu must fully cover the page underneath
              // (logo/map bleeding through read as overlapping UI on mobile).
              background: 'rgba(0,0,0,0.97)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              padding: '112px 24px 40px',
            }}
          >
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 24,
                width: '100%',
              }}
            >
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  data-cms-key={`nav.link.${item.key}`}
                  style={{
                    fontSize: 30,
                    fontWeight: 600,
                    color: pathname === item.href ? tokens.colors.brand : tokens.colors.text,
                    textDecoration: 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                {navText(item.key, item.key === 'home' ? 'Home' : item.key)}
                </Link>
              ))}

              {loggedIn && (
                <PlainLink
                  href="/member"
                  onClick={() => setMenuOpen(false)}
                  data-cms-key="nav.link.member"
                  style={{
                    fontSize: 30,
                    fontWeight: 600,
                    color: pathname === '/member' ? tokens.colors.brand : tokens.colors.text,
                    textDecoration: 'none',
                    whiteSpace: 'nowrap',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <MemberIcon size={12} />
                  {navText('member', 'Member')}
                </PlainLink>
              )}

              <button
                onClick={() => {
                  setMenuOpen(false)
                  toggleLocale()
                }}
                aria-label="Switch language"
                style={{
                  marginTop: 8,
                  minHeight: 44,
                  fontSize: 18,
                  fontWeight: 500,
                  color: tokens.colors.brand,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 8,
                }}
              >
                {locale === 'zh-HK' ? '繁中' : locale === 'zh-CN' ? '简中' : 'English'}
              </button>
            </div>

            <div style={{ width: '100%', paddingTop: 24 }}>
              <Link href="/book" onClick={() => setMenuOpen(false)} style={{ textDecoration: 'none' }}>
                <Button variant="primary" size="lg" fullWidth>
                  {t('book')}
                </Button>
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AuthModal
        open={loginModalOpen}
        returnUrl={returnUrl}
        onClose={() => setLoginModalOpen(false)}
        onAuthComplete={() => setLoginModalOpen(false)}
        dismissible
      />
    </>
  )
}
