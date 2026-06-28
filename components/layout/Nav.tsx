'use client'

import { useState, useEffect } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Menu, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link, usePathname, useRouter } from '@/i18n/navigation'
import { tokens } from '@/app/styles/tokens'
import { Logo } from '@/components/brand'
import { Button } from '@/components/ui'

const navItems = [
  { href: '/book', key: 'book' },
  { href: '/pricing', key: 'pricing' },
  { href: '/about', key: 'about' },
  { href: '/blog', key: 'blog' },
] as const

type NavTheme = 'dark' | 'light'

const PILL_TRANSITION = 'all 0.25s ease'

// Pill chrome resolves from the background behind the navbar.
function pillStyle(theme: NavTheme): React.CSSProperties {
  const dark = theme === 'dark'
  return {
    background: dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
    border: `1px solid ${dark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.15)'}`,
    backdropFilter: 'blur(20px) saturate(180%)',
    WebkitBackdropFilter: 'blur(20px) saturate(180%)',
    borderRadius: 999,
    pointerEvents: 'auto',
    transition: PILL_TRANSITION,
  }
}

export default function Nav() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [theme, setTheme] = useState<NavTheme>('dark')
  const pathname = usePathname()
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations('nav')

  const LOCALES = ['zh-HK', 'zh-CN', 'en', 'ja'] as const
  const LOCALE_LABELS: Record<string, string> = {
    'zh-HK': '繁',
    'zh-CN': '简',
    en: 'EN',
    ja: 'JP',
  }

  const toggleLocale = () => {
    const idx = LOCALES.indexOf(locale as (typeof LOCALES)[number])
    const next = LOCALES[(idx + 1) % LOCALES.length]
    router.replace(pathname, { locale: next })
  }

  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [menuOpen])

  // Auto light/dark: on scroll, read whatever element sits directly behind the
  // navbar and walk up to its [data-nav-theme]; fall back to bg luminance.
  // Sample below the pill (y=72) so the pill itself isn't what's hit-tested.
  useEffect(() => {
    const updateNavTheme = () => {
      const probeX = window.innerWidth / 2
      const el = document.elementFromPoint(probeX, 72)
      if (!el) return

      let target: Element | null = el
      while (target && target !== document.body) {
        const t = target.getAttribute('data-nav-theme')
        if (t === 'dark' || t === 'light') {
          setTheme(t)
          return
        }
        target = target.parentElement
      }

      // No tagged ancestor — infer from the element's background luminance.
      const bg = window.getComputedStyle(el).backgroundColor
      const rgb = bg.match(/\d+/g)?.map(Number) ?? [0, 0, 0]
      const luminance = (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000
      setTheme(luminance < 128 ? 'dark' : 'light')
    }

    updateNavTheme()
    window.addEventListener('scroll', updateNavTheme, { passive: true })
    window.addEventListener('resize', updateNavTheme, { passive: true })
    return () => {
      window.removeEventListener('scroll', updateNavTheme)
      window.removeEventListener('resize', updateNavTheme)
    }
  }, [pathname])

  const linkColor = theme === 'dark' ? '#ffffff' : '#1a1a1a'

  return (
    <>
      {/* Wrapper — transparent, centred, clicks pass through empty areas */}
      <nav
        style={{
          position: 'fixed',
          top: 20,
          left: 0,
          right: 0,
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 16px',
          background: 'transparent',
          border: 'none',
          pointerEvents: 'none',
        }}
        className="nav-bar"
      >
        {/* Logo — floats top-left, absolute so the pill stays centred */}
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
        >
          <Logo variant="full" theme={theme} size={28} />
        </Link>

        {/* Desktop links — centred frosted pill */}
        <div
          className="nav-center"
          style={{
            ...pillStyle(theme),
            display: 'none',
            alignItems: 'center',
            gap: 28,
            padding: '10px 24px',
          }}
        >
          {navItems.map((item) => {
            const active = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: active ? tokens.colors.brand : linkColor,
                  textDecoration: 'none',
                  whiteSpace: 'nowrap',
                  transition: PILL_TRANSITION,
                }}
              >
                {t(item.key)}
              </Link>
            )
          })}

          {/* Divider + language switcher */}
          <span
            style={{
              width: 1,
              height: 14,
              background: theme === 'dark' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)',
              margin: '0 4px',
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

        {/* Mobile — hamburger pill, floats top-right */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="nav-hamburger"
          style={{
            ...pillStyle(theme),
            position: 'absolute',
            right: 16,
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 48,
            height: 44,
            cursor: 'pointer',
            color: linkColor,
            padding: 0,
            WebkitTapHighlightColor: 'transparent',
          }}
          aria-label={menuOpen ? '關閉選單' : '開啟選單'}
        >
          <motion.span
            animate={{ rotate: menuOpen ? 90 : 0, opacity: menuOpen ? 0 : 1 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            style={{ position: 'absolute', display: 'flex' }}
          >
            <Menu size={20} />
          </motion.span>
          <motion.span
            animate={{ rotate: menuOpen ? 0 : -90, opacity: menuOpen ? 1 : 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            style={{ position: 'absolute', display: 'flex' }}
          >
            <X size={20} />
          </motion.span>
        </button>

        {/* Desktop — Book CTA, floats top-right */}
        <Link
          href="/book"
          className="nav-cta-desktop"
          style={{
            position: 'absolute',
            right: 32,
            top: '50%',
            transform: 'translateY(-50%)',
            textDecoration: 'none',
            pointerEvents: 'auto',
            display: 'none',
          }}
        >
          <span
            data-cms-key="nav.book-desktop"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: tokens.colors.brand,
              color: '#000',
              borderRadius: tokens.radius.pill,
              padding: '10px 20px',
              fontWeight: 700,
              fontSize: 14,
              whiteSpace: 'nowrap',
            }}
          >
            {t('book')}
          </span>
        </Link>
      </nav>

      {/* Responsive breakpoint styles */}
      <style jsx global>{`
        @media (min-width: 768px) {
          .nav-bar {
            padding: 0 32px !important;
          }
          .nav-center {
            display: flex !important;
          }
          .nav-hamburger {
            display: none !important;
          }
          .nav-cta-desktop {
            display: block !important;
          }
        }
      `}</style>

      {/* Mobile fullscreen menu overlay */}
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
              padding: '48px 32px',
            }}
          >
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 32,
              }}
            >
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  data-cms-key={`nav.link.${item.key}`}
                  style={{
                    fontSize: 32,
                    fontWeight: 600,
                    color: tokens.colors.text,
                    textDecoration: 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {t(item.key)}
                </Link>
              ))}

              {/* Language switcher — mobile */}
              <button
                onClick={() => {
                  setMenuOpen(false)
                  toggleLocale()
                }}
                aria-label="Switch language"
                style={{
                  fontSize: 20,
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

            <div style={{ width: '100%', paddingTop: 32 }}>
              <Link href="/book" onClick={() => setMenuOpen(false)} style={{ textDecoration: 'none' }}>
                <Button variant="primary" size="lg" fullWidth>
                  {t('book')}
                </Button>
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
