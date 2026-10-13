// Single source of truth for venue NAP (Name, Address, Phone) plus hours and
// map links. Footer, contact surfaces, JSON-LD and outbound emails all read
// from here so the wording cannot drift between them — the English building
// name in particular had already drifted ("Laurels" vs "Tai Lee").
//
// Name/address/phone are NOT in the `config` table — only hours and prices are
// — so they live here. Hours and prices are always passed in from getConfig().
import { SITE_CONTACT } from './contact'

export const VENUE_NAME = 'SPACE8'

// English building name is "Laurels Industrial Centre" (confirmed 2026-10-13).
// The Chinese name of the same building is 泰力工業中心. Never write "Tai Lee".
export const ADDRESS = {
  /** Street + building + unit, Chinese. Used in JSON-LD PostalAddress. */
  streetAddressZh: '大有街32號泰力工業中心3樓05室',
  /** Street + building + unit, English. Used in JSON-LD and English emails. */
  streetAddressEn: 'Room 05, 3/f, Laurels Industrial Centre, Tai Yau Street 32',
  addressLocality: '新蒲崗',
  addressLocalityEn: 'San Po Kong',
  addressRegion: '九龍',
  addressRegionEn: 'Kowloon',
  addressCountry: 'HK',
  /** Display string for Chinese surfaces (footer, contact, about). Matches
   *  messages/zh-HK.json `footer.address`. */
  displayZh: '香港新蒲崗大有街 32 號泰力工業中心 3 樓 05 室',
  /** Display string for English surfaces (transactional emails). */
  displayEn: 'Room 05, 3/f, Laurels Industrial Centre, Tai Yau Street 32, San Po Kong, Hong Kong',
} as const

// Venue geo — same coordinates the footer map marker uses
// (components/layout/FooterMap.tsx SPACE8_COORDS). Not stored in `config`;
// re-verify against the Google Business Profile pin before editing.
export const GEO = { lat: 22.3372097, lng: 114.1973068 } as const

/** Free-form query string for Google Maps search links and embeds. */
export const MAP_QUERY = `${ADDRESS.streetAddressEn.replace(/^Room \d+, /, '')}, Hong Kong`

/** Google Maps search URL — the "Google Maps 導航" links in footer and contact. */
export const MAPS_URL = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(MAP_QUERY)}`

/** Google Business Profile / Maps place URL for JSON-LD `hasMap` and the site's
 *  "view on Google Maps" link. Falls back to the search URL until a place URL
 *  is supplied (see the "needs Luca" list). */
export const GOOGLE_MAPS_PLACE_URL = MAPS_URL

export type HoursSpec = { opens: string; closes: string; days: string[] }

const ALL_DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
]

function hhmm(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`
}

/** Format config `site.openHour`/`closeHour` (numbers) into schema.org hours.
 *  closeHour 24 renders as "24:00", which schema.org accepts for end-of-day. */
export function formatOpeningHours(openHour: number, closeHour: number): HoursSpec {
  return {
    opens: hhmm(openHour),
    closes: hhmm(closeHour),
    days: ALL_DAYS,
  }
}

/** Human-readable Chinese hours line, e.g. "每日 06:00 至 24:00". Mirrors
 *  messages/zh-HK.json `footer.hours`. */
export function formatHoursZh(openHour: number, closeHour: number): string {
  return `每日 ${hhmm(openHour)} 至 ${hhmm(closeHour)}`
}

/** schema.org openingHoursSpecification, "Mo-Su 06:00-24:00" for microdata. */
export function formatHoursIso(openHour: number, closeHour: number): string {
  return `Mo-Su ${hhmm(openHour)}-${hhmm(closeHour)}`
}

export { SITE_CONTACT }
