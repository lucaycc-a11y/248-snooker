// Single switch for the public Space Pilot marketing page (/spacepilot).
// true = page is visible to everyone (indexable, in the sitemap and nav). The product itself stays
// beta / limited players; the page copy says so.
// false = admin-only: the page 404s for everyone else, is noindex and stays out of the sitemap.
export const SPACEPILOT_PUBLIC = true

// FAQ entries shown on the page and in its FAQPage JSON-LD (they must match). #5 (highlights/recording) is hidden.
export const PILOT_FAQ_IDS = [1, 2, 3, 9, 4, 6, 7, 8] as const

// Public launch: 15 Dec 2026, 00:00 Hong Kong time. The /spacepilot page is force-dynamic, so the
// "Beta" badge, countdown, meta titles and FAQ flip on their own at this moment — no deploy needed.
export const SPACEPILOT_LAUNCH_AT = '2026-12-15T00:00:00+08:00'
export const spacePilotLaunched = (now: number = Date.now()): boolean => now >= new Date(SPACEPILOT_LAUNCH_AT).getTime()
