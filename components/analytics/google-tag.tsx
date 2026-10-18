"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";

/**
 * Google Ads tag (gtag.js). Public identifier — visible in page source by design.
 * Must be loaded before individual event snippets can measure conversions.
 */
const GOOGLE_TAG_ID = "AW-18400521232";

/**
 * Internal routes that must never report to Google Ads. Staff using /admin
 * would otherwise land in remarketing lists and pollute page-view counts that
 * PMax uses for bid signals.
 */
const UNTRACKED_PATH_PREFIXES = [
  "/admin",
  "/admin-shell-preview",
  "/uat-gate",
  "/hero-preview",
  "/style-guide-preview",
  "/_components-demo",
];

/**
 * Which environments should send hits to Google Ads.
 *
 * Dev and UAT traffic must never reach the Ads account: it inflates page-view
 * counts, poisons smart-bidding conversion rates, and can burn budget on
 * remarketing lists full of staff and test sessions.
 *
 * Production builds on UAT (NODE_ENV is "production" there too) are excluded
 * via NEXT_PUBLIC_APP_ENV, matching UatBadge.
 */
function shouldMeasure(): boolean {
  if (process.env.NEXT_PUBLIC_APP_ENV === "uat") return false;
  return process.env.NODE_ENV === "production";
}

function isUntrackedPath(pathname: string): boolean {
  return UNTRACKED_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Loads the Google tag on every public route. Mounted from the root layout so
 * the tag is present site-wide — what Google requires for it to count as
 * installed — then narrowed by path so /admin and internal previews stay dark.
 */
export function GoogleTag() {
  const pathname = usePathname();

  if (!shouldMeasure()) return null;
  if (isUntrackedPath(pathname)) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GOOGLE_TAG_ID}`}
        strategy="afterInteractive"
      />
      <Script id="google-tag" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GOOGLE_TAG_ID}');
        `}
      </Script>
    </>
  );
}
