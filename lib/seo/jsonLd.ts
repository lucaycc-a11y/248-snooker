import {
  ADDRESS,
  GEO,
  GOOGLE_MAPS_PLACE_URL,
  VENUE_NAME,
  SITE_CONTACT,
  formatOpeningHours,
} from "@/lib/site/nap";
import { MAIN_PHOTOS } from "@/lib/seo/imageManifest";
import { IN_LANGUAGE, SITE_URL } from "@/lib/seo/site";

// Raster logo (Google's logo guidelines prefer PNG/JPG over SVG).
const LOGO_URL = `${SITE_URL}/favicon/web-app-manifest-512x512.png`;

const SAME_AS = ["https://www.instagram.com/248snooker"];

type OfferPeriod = {
  id: string;
  rate: number;
  rateFrom2h?: number;
  start: string;
  end: string;
};

function localisedAddress(locale: string) {
  const zh = locale.startsWith("zh");
  return {
    "@type": "PostalAddress",
    streetAddress: zh ? ADDRESS.streetAddressZh : ADDRESS.streetAddressEn,
    addressLocality: zh ? ADDRESS.addressLocality : ADDRESS.addressLocalityEn,
    addressRegion: zh ? ADDRESS.addressRegion : ADDRESS.addressRegionEn,
    addressCountry: ADDRESS.addressCountry,
  };
}

// priceRange must describe the venue's actual rate span. The conventional form
// is "$" repeated to a band; we derive the band from the config-backed rates so
// the schema and the UI cannot drift.
function priceRangeFromPeriods(periods: OfferPeriod[]): string {
  const rates = periods.flatMap((p) => (p.rateFrom2h ? [p.rate, p.rateFrom2h] : [p.rate]));
  const min = Math.min(...rates);
  return min >= 300 ? "$$$$" : min >= 100 ? "$$$" : min >= 30 ? "$$" : "$";
}

/**
 * Venue schema — the single LocalBusiness representation, rendered on the home
 * page and /venue. @type is SportsActivityLocation (a LocalBusiness subtype):
 * the most specific type for a bookable sports venue, so it satisfies both the
 * LocalBusiness rich-result family and sports-venue semantics.
 *
 * `periods` and `openHour`/`closeHour` flow from the same `config` rows the
 * pricing cards render from — never hardcoded.
 */
export function buildSportsClubJsonLd(
  locale: string,
  path: string,
  options: {
    periods?: OfferPeriod[];
    openHour?: number;
    closeHour?: number;
  } = {}
) {
  const { periods, openHour = 6, closeHour = 24 } = options;
  const hours = formatOpeningHours(openHour, closeHour);

  return {
    "@context": "https://schema.org",
    "@type": ["SportsActivityLocation", "LocalBusiness"],
    name: VENUE_NAME,
    description: "香港新蒲崗自助無煙中八獨立球室，全預約制",
    url: `${SITE_URL}${locale === "zh-HK" ? path : `/${locale}${path}`}`,
    telephone: SITE_CONTACT.phone,
    email: SITE_CONTACT.email,
    address: localisedAddress(locale),
    geo: {
      "@type": "GeoCoordinates",
      latitude: GEO.lat,
      longitude: GEO.lng,
    },
    hasMap: GOOGLE_MAPS_PLACE_URL,
    areaServed: [
      { "@type": "City", name: "香港" },
      { "@type": "Place", name: "九龍" },
    ],
    openingHoursSpecification: {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: hours.days,
      opens: hours.opens,
      closes: hours.closes,
    },
    ...(periods && periods.length > 0 && { priceRange: priceRangeFromPeriods(periods) }),
    sameAs: SAME_AS,
    image: MAIN_PHOTOS.map((src) => `${SITE_URL}${encodeURI(src)}`),
    logo: LOGO_URL,
    inLanguage: IN_LANGUAGE,
    amenityFeature: [
      { "@type": "LocationFeatureSpecification", name: "Self-service booking", value: true },
      { "@type": "LocationFeatureSpecification", name: "Smoke-free", value: true },
    ],
  };
}

/**
 * Organization schema for the home page. Organization is the entity Google
 * resolves the favicon/logo and knowledge panel from.
 */
export function buildOrganizationJsonLd(locale: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: VENUE_NAME,
    url: SITE_URL,
    logo: LOGO_URL,
    email: SITE_CONTACT.email,
    telephone: SITE_CONTACT.phone,
    address: localisedAddress(locale),
    sameAs: SAME_AS,
  };
}

export function buildWebSiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    url: SITE_URL,
    name: VENUE_NAME,
    inLanguage: IN_LANGUAGE,
    publisher: { "@id": `${SITE_URL}/#organization` },
  };
}

/**
 * FAQPage schema. Emit ONLY for Q&A that is visibly rendered on the page —
 * Google penalises schema for content the user cannot see.
 */
export function buildFaqPageJsonLd(
  items: ReadonlyArray<{ question: string; answer: string }>
) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}

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
    name: "SPACE8 中八球枱時租",
    description: "香港新蒲崗自助中八球枱按時段時租，全預約制",
    brand: { "@type": "Brand", name: "SPACE8" },
    offers: periods.map((p) => ({
      "@type": "Offer",
      name: labels.name(p.id),
      price: String(p.rate),
      priceCurrency: "HKD",
      description: labels.description(p),
      availability: "https://schema.org/InStock",
      url: `${SITE_URL}/book`,
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

// Serialize JSON-LD as a <script> body.
//
// React escapes text children, but inside <script> the browser does not decode
// HTML entities — so a raw `&`/`<`/`>` in dynamic JSON (e.g. a post title) would
// either break the JSON or allow a `</script>` breakout. We escape those three
// characters to their \uXXXX JSON forms, which crawlers parse back correctly and
// which contain no HTML-significant characters.
//
// MUST be injected as raw script text (see the home page's JSON-LD block for the
// established pattern), never as a React text child: a text child makes React
// HTML-escape the quotes to &quot;, which the browser does not decode inside
// <script> — the JSON becomes unparseable. That silently broke /venue and /about.
export function safeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}
