// Single switch for the public Space Pilot marketing page (/spacepilot).
// true = page is visible to everyone (indexable, in the sitemap and nav). The product itself stays
// beta / limited players; the page copy says so.
// false = admin-only: the page 404s for everyone else, is noindex and stays out of the sitemap.
export const SPACEPILOT_PUBLIC = true

// FAQ entries shown on the page and in its FAQPage JSON-LD (they must match). #5 (highlights/recording) is hidden.
export const PILOT_FAQ_IDS = [1, 2, 3, 4, 6, 7, 8] as const
