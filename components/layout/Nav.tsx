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
import { SignInPrompt } from '@/components/auth/SignInPrompt'
import { AuthModal } from '@/components/auth/AuthModal'
import { createClient } from '@/lib/supabase/client'

const navItems = [
  { href: '/', key: 'home' },
  { href: '/book', key: 'book' },
  { href: '/pricing', key: 'pricing' },
  { href: '/about', key: 'about' },
  { href: '/blog', key: 'blog' },
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
    ja: 'JP',
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
    })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setLoggedIn(!!session)
      setAvatarUrl(session?.user?.user_metadata?.avatar_url ?? null)
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
      <SignInPrompt onOpenLogin={() => setLoginModalOpen(true)} hidden={menuOpen} />
      <nav
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
            pointerEvents: 'auto',
          }}
          className="nav-logo"
          aria-label={t('home')}
        >
          <Logo variant="full" theme={theme} size={52} />
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

          <PlainLink
            href="/member"
            data-cms-key="nav.link.member"
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: pathname === '/member' ? tokens.colors.brand : linkColor,
              textDecoration: 'none',
              whiteSpace: 'nowrap',
              transition: PILL_TRANSITION,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <User size={14} strokeWidth={1.8} />
            {navText('member', 'Member')}
          </PlainLink>

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
          {loggedIn ? (
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
              background: 'rgba(0,0,0,0.92)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
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
                {locale === 'zh-HK' ? '繁中' : locale === 'zh-CN' ? '简中' : locale === 'en' ? 'English' : '日本語'}
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
