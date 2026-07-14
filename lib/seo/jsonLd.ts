const BASE = "https://space8.com.hk";

// Single source of truth for the SportsClub schema — was previously
// duplicated (and drifting: different priceRange/closes time) between
// app/layout.tsx and app/[locale]/about/page.tsx.
export function buildSportsClubJsonLd(locale: string, path: string) {
  return {
    "@context": "https://schema.org",
    "@type": "SportsClub",
    name: "Space8",
    description: "香港自助中式桌球預訂平台，每日 06:00 至 24:00 營業",
    url: `${BASE}${locale === "zh-HK" ? path : `/${locale}${path}`}`,
    telephone: "+85264274620",
    email: "info.formhk@gmail.com",
    address: {
      "@type": "PostalAddress",
      streetAddress: "Room 05, 3/F, Tai Lik Industrial Centre, 32 Tai Yau Street, San Po Kong",
      addressCountry: "HK",
      addressRegion: "Hong Kong",
    },
    openingHoursSpecification: {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
      opens: "06:00",
      closes: "24:00",
    },
    priceRange: "HK$78-108/hr",
    amenityFeature: [
      { "@type": "LocationFeatureSpecification", name: "Self-service booking", value: true },
      { "@type": "LocationFeatureSpecification", name: "Apple Pay", value: true },
    ],
  };
}

// Render JSON-LD structured data safely as escaped <script> children.
//
// React escapes text children, but inside <script> the browser does not decode
// HTML entities — so a raw `&`/`<`/`>` in dynamic JSON (e.g. a post title) would
// either break the JSON or allow a `</script>` breakout. We escape those three
// characters to their \uXXXX JSON forms, which crawlers parse back correctly and
// which contain no HTML-significant characters. Use as:
//   <script type="application/ld+json">{safeJsonLd(data)}</script>
export function safeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
}
