"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";

const NAV_LINKS = [
  { label: "Book", href: "/book" },
  { label: "Pricing", href: "/pricing" },
  { label: "About", href: "/about" },
  { label: "Blog", href: "/blog" },
] as const;

const GREEN = "#1A6B35";

const menuContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
  exit: {},
};

const menuItem = {
  hidden: { y: 20, opacity: 0 },
  show: {
    y: 0,
    opacity: 1,
    transition: { type: "spring", stiffness: 300, damping: 30 },
  },
  exit: { y: 20, opacity: 0, transition: { duration: 0.15 } },
};

interface NavTheme {
  logo: string;
  pillBg: string;
  pillBorder: string;
  linkColor: string;
  loginBorder: string;
  loginColor: string;
  hamburgerBg: string;
  hamburgerBorder: string;
}

// Nav is always dark — colors never change on scroll.
const theme: NavTheme = {
  logo: "/2.svg",
  pillBg: "rgba(28,28,30,0.55)",
  pillBorder: "rgba(255,255,255,0.10)",
  linkColor: "rgba(255,255,255,0.82)",
  loginBorder: "rgba(255,255,255,0.25)",
  loginColor: "#ffffff",
  hamburgerBg: "rgba(28,28,30,0.55)",
  hamburgerBorder: "rgba(255,255,255,0.12)",
};

const COLOR_TRANSITION = "all 0.4s ease";

// Parse a CSS color string ("rgb(...)" / "rgba(...)") into channels.
function parseRGBA(value: string): { r: number; g: number; b: number; a: number } | null {
  const match = value.match(/rgba?\(([^)]+)\)/);
  if (!match) return null;
  const parts = match[1].split(",").map((p) => parseFloat(p.trim()));
  const [r, g, b, a = 1] = parts;
  if ([r, g, b].some((n) => Number.isNaN(n))) return null;
  return { r, g, b, a };
}

// Is the background directly under (x, y) a light color? Walks up from the
// topmost non-nav element to the first opaque background and checks luminance.
function isLightAt(x: number, y: number): boolean {
  const els = document.elementsFromPoint(x, y);
  for (const el of els) {
    if ((el as HTMLElement).closest("[data-nav]")) continue;
    let node: HTMLElement | null = el as HTMLElement;
    while (node) {
      const rgba = parseRGBA(getComputedStyle(node).backgroundColor);
      if (rgba && rgba.a > 0.5) {
        const luminance = (0.299 * rgba.r + 0.587 * rgba.g + 0.114 * rgba.b) / 255;
        return luminance > 0.5;
      }
      node = node.parentElement;
    }
  }
  return false;
}

export default function Nav() {
  const [isLight, setIsLight] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Sample the background behind the nav so the logo + login adapt to any section.
  useEffect(() => {
    const update = () => {
      // Probe at the nav's vertical band, on the side where the logo/login sit.
      const probeY = window.innerWidth < 768 ? 34 : 36;
      const left = isLightAt(40, probeY);
      const right = isLightAt(window.innerWidth - 60, probeY);
      setIsLight(left || right);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  // Lock body scroll while the mobile menu is open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  // Menu overlay is dark, so bars are always white.
  const hamburgerLine = "white";

  // The logo SVG renders white; invert it to dark over light sections.
  // While the mobile menu is open, the dark overlay sits behind it — keep it white.
  const logoFilter = isLight && !menuOpen ? "invert(1)" : "none";

  // Login sits on a transparent background, so flip its border + text to stay legible.
  const loginBorder = isLight ? "rgba(0,0,0,0.22)" : "rgba(255,255,255,0.25)";
  const loginColor = isLight ? "#1D1D1F" : "#ffffff";

  return (
    <>
      {/* Logo — desktop only, top left */}
      <Link
        href="/"
        data-nav
        className="fixed top-5 left-6 z-50 hidden items-center md:flex"
        aria-label="248 Snooker Club"
      >
        <Image
          src={theme.logo}
          alt="248 Snooker Club"
          width={48}
          height={48}
          priority
          className="h-16 w-auto"
          style={{ filter: logoFilter, transition: COLOR_TRANSITION }}
        />
      </Link>

      {/* Mobile header bar */}
      <div
        data-nav
        className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-between md:hidden"
        style={{ padding: "12px 20px" }}
      >
        {/* Logo — left side */}
        <Link href="/" aria-label="248 Snooker Club" className="flex items-center">
          <Image
            src={theme.logo}
            alt="248 Snooker Club"
            width={44}
            height={44}
            priority
            className="h-11 w-auto"
            style={{ filter: logoFilter, transition: COLOR_TRANSITION }}
          />
        </Link>

        {/* Right group — 立即預訂 + hamburger */}
        <div className="flex items-center" style={{ gap: "8px" }}>
          <Link
            href="/book"
            className="inline-flex font-semibold text-white"
            style={{
              background: GREEN,
              borderRadius: "100px",
              padding: "8px 16px",
              fontSize: "14px",
              fontWeight: 600,
            }}
          >
            立即預訂
          </Link>

          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            className="flex items-center justify-center"
            style={{
              background: theme.hamburgerBg,
              backdropFilter: "blur(24px) saturate(180%)",
              WebkitBackdropFilter: "blur(24px) saturate(180%)",
              border: `1px solid ${theme.hamburgerBorder}`,
              borderRadius: "100px",
              padding: "10px 16px",
              transition: COLOR_TRANSITION,
            }}
          >
            <span
              className="relative flex flex-col items-center justify-center"
              style={{ width: "20px", height: "16px" }}
            >
              <motion.span
                animate={menuOpen ? { rotate: 45, y: 6 } : { rotate: 0, y: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                style={{
                  position: "absolute",
                  top: "2px",
                  width: "20px",
                  height: "2px",
                  borderRadius: "2px",
                  background: hamburgerLine,
                }}
              />
              <motion.span
                animate={{ opacity: menuOpen ? 0 : 1 }}
                transition={{ duration: 0.15 }}
                style={{
                  position: "absolute",
                  top: "8px",
                  width: "20px",
                  height: "2px",
                  borderRadius: "2px",
                  background: hamburgerLine,
                }}
              />
              <motion.span
                animate={menuOpen ? { rotate: -45, y: -6 } : { rotate: 0, y: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                style={{
                  position: "absolute",
                  top: "14px",
                  width: "20px",
                  height: "2px",
                  borderRadius: "2px",
                  background: hamburgerLine,
                }}
              />
            </span>
          </button>
        </div>
      </div>

      {/* Pill island — centered, hidden on mobile */}
      <nav
        data-nav
        className="fixed top-5 left-1/2 z-50 hidden -translate-x-1/2 md:block"
        aria-label="Main navigation"
      >
        <div
          className="flex items-center"
          style={{
            gap: "32px",
            padding: "10px 24px",
            borderRadius: "100px",
            border: `1px solid ${theme.pillBorder}`,
            background: theme.pillBg,
            backdropFilter: "blur(24px) saturate(180%)",
            WebkitBackdropFilter: "blur(24px) saturate(180%)",
            transition: COLOR_TRANSITION,
          }}
        >
          {NAV_LINKS.slice(0, 3).map((link) => (
            <Link
              key={link.label}
              href={link.href}
              style={{
                fontSize: "15px",
                fontWeight: 400,
                letterSpacing: "-0.01em",
                color: theme.linkColor,
                transition: COLOR_TRANSITION,
              }}
            >
              {link.label}
            </Link>
          ))}

          {/* Divider between About and Blog */}
          <span
            aria-hidden="true"
            style={{
              width: "1px",
              height: "16px",
              background: theme.pillBorder,
              transition: COLOR_TRANSITION,
            }}
          />

          <Link
            href="/blog"
            style={{
              fontSize: "15px",
              fontWeight: 400,
              letterSpacing: "-0.01em",
              color: theme.linkColor,
              transition: COLOR_TRANSITION,
            }}
          >
            Blog
          </Link>
        </div>
      </nav>

      {/* Right side — desktop: Login + Book Now */}
      <div
        data-nav
        className="fixed top-5 right-6 z-[70] hidden items-center gap-3 md:flex"
      >
        <Link
          href="/auth/login"
          className="inline-flex rounded-full border px-4 py-2 text-sm"
          style={{
            borderColor: loginBorder,
            color: loginColor,
            transition: COLOR_TRANSITION,
          }}
        >
          Login
        </Link>

        <motion.div
          whileHover={{ scale: 1.02, filter: "brightness(1.1)" }}
          whileTap={{ scale: 0.97 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        >
          <Link
            href="/book"
            className="inline-flex rounded-full px-5 py-2 text-sm font-semibold text-white"
            style={{ background: GREEN }}
          >
            Book Now
          </Link>
        </motion.div>
      </div>

      {/* Mobile full-screen menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            key="mobile-menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[60] flex flex-col items-center justify-center md:hidden"
            style={{
              background: "rgba(0,0,0,0.96)",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
            }}
          >
            <motion.div
              variants={menuContainer}
              initial="hidden"
              animate="show"
              exit="exit"
              className="flex flex-col items-center"
              style={{ gap: "24px" }}
            >
              {NAV_LINKS.map((link) => (
                <motion.div key={link.label} variants={menuItem}>
                  <Link
                    href={link.href}
                    onClick={() => setMenuOpen(false)}
                    className="text-white transition-colors duration-200"
                    style={{ fontSize: "32px", fontWeight: 500 }}
                  >
                    {link.label}
                  </Link>
                </motion.div>
              ))}

              {/* Divider */}
              <motion.span
                variants={menuItem}
                aria-hidden="true"
                style={{
                  width: "120px",
                  height: "1px",
                  background: "rgba(255,255,255,0.2)",
                }}
              />

              <motion.div variants={menuItem}>
                <Link
                  href="/auth/login"
                  onClick={() => setMenuOpen(false)}
                  className="text-white transition-colors duration-200"
                  style={{ fontSize: "32px", fontWeight: 500 }}
                >
                  Login
                </Link>
              </motion.div>

              <motion.div variants={menuItem} className="w-[80vw] max-w-[320px]">
                <Link
                  href="/book"
                  onClick={() => setMenuOpen(false)}
                  className="flex w-full items-center justify-center rounded-full font-semibold text-white"
                  style={{
                    background: GREEN,
                    padding: "16px 32px",
                    fontSize: "28px",
                  }}
                >
                  立即預訂
                </Link>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
