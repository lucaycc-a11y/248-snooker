// Single source of truth for the venue's physical address and its Google
// Maps deep-link. Used by the Footer (every page) and the /venue page.
// NOTE: this is a fixed physical location, not booking/pricing/tier data —
// out of scope for the `config` table per CLAUDE.md's pricing-only rule.
export const VENUE_ADDRESS = {
  "zh-HK": "香港新蒲崗大有街 32 號泰力工業中心 3 樓 05 室",
  "zh-CN": "香港新蒲岗大有街 32 号泰力工业中心 3 楼 05 室",
  en: "Room 05, 3/F, Trend Centre, 32 Tai Yau Street, San Po Kong, Hong Kong",
} as const;

export function getVenueAddress(locale: string): string {
  return VENUE_ADDRESS[locale as keyof typeof VENUE_ADDRESS] ?? VENUE_ADDRESS["zh-HK"];
}

export function getVenueMapsUrl(locale: string): string {
  return (
    "https://www.google.com/maps/dir/?api=1&destination=" +
    encodeURIComponent(getVenueAddress(locale))
  );
}
