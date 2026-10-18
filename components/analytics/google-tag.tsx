import Script from "next/script";

/**
 * Google Ads tag (gtag.js). Public identifier — visible in page source by design.
 * Must be loaded before individual event snippets can measure conversions.
 */
const GOOGLE_TAG_ID = "AW-18400521232";

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

/**
 * Loads the Google tag on every route. Rendering it from the root layout is
 * what makes this "every page", which is what Google requires for the tag to
 * be considered installed.
 */
export function GoogleTag() {
  if (!shouldMeasure()) return null;

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
