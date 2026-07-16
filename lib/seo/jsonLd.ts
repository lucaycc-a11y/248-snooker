const BASE = "https://space8.com.hk";

// Venue geo — same coordinates the footer map marker uses
// (components/layout/FooterMap.tsx SPACE8_COORDS).
const GEO = { lat: 22.3372097, lng: 114.1973068 };

const SAME_AS = ["https://www.instagram.com/248snooker"];

// Single source of truth for the venue schema — was previously duplicated
// (and drifting: different priceRange/closes time) between app/layout.tsx and
// app/[locale]/about/page.tsx.
//
// @type is SportsActivityLocation (a LocalBusiness subtype): it's the most
// specific type for a bookable sports venue, so it satisfies both the
// "LocalBusiness" rich-result family and sports-venue semantics. Includes
// localised locality/region (新蒲崗 / 九龍), geo, and social sameAs for GEO.
export function buildSportsClubJsonLd(locale: string, path: string) {
  return {
    "@context": "https://schema.org",
    "@type": ["SportsActivityLocation", "LocalBusiness"],
    name: "Space8",
    description: "香港新蒲崗自助無煙中式桌球獨立球室，每日 06:00 至 24:00 營業",
    url: `${BASE}${locale === "zh-HK" ? path : `/${locale}${path}`}`,
    telephone: "+85264274620",
    email: "info.formhk@gmail.com",
    address: {
      "@type": "PostalAddress",
      streetAddress: "大有街32號泰力工業中心3樓05室",
      addressLocality: "新蒲崗",
      addressRegion: "九龍",
      addressCountry: "HK",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: GEO.lat,
      longitude: GEO.lng,
    },
    openingHoursSpecification: {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
      opens: "06:00",
      closes: "24:00",
    },
    priceRange: "$78-$108",
    sameAs: SAME_AS,
    amenityFeature: [
      { "@type": "LocationFeatureSpecification", name: "Self-service booking", value: true },
      { "@type": "LocationFeatureSpecification", name: "Apple Pay", value: true },
      { "@type": "LocationFeatureSpecification", name: "Smoke-free", value: true },
    ],
  };
}

type OfferPeriod = {
  id: string;
  rate: number;
  rateFrom2h?: number;
  start: string;
  end: string;
};

// Per-period Offer schema for /pricing. Rates flow from the same config the
// pricing cards render from (never hardcoded) so schema + UI can't drift.
// `name`/`description` are localised via the passed labeller.
export function buildPricingOffersJsonLd(
  periods: OfferPeriod[],
  labels: { name: (id: string) => string; description: (p: OfferPeriod) => string },
) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "Space8 桌球球枱時租",
    description: "香港新蒲崗自助中式桌球球枱按時段時租",
    brand: { "@type": "Brand", name: "Space8" },
    offers: periods.map((p) => ({
      "@type": "Offer",
      name: labels.name(p.id),
      price: String(p.rateFrom2h ?? p.rate),
      priceCurrency: "HKD",
      description: labels.description(p),
      availability: "https://schema.org/InStock",
      url: `${BASE}/book`,
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: String(p.rate),
        priceCurrency: "HKD",
        unitCode: "HUR",
        referenceQuantity: { "@type": "QuantitativeValue", value: 1, unitCode: "HUR" },
      },
    })),
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
