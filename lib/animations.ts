/** Shared animation constants for scroll-reveal entrances */

/** Bouncy pop curve — for card/icon/button "object" elements. Vary scale-from per context. */
export const POP = [0.34, 1.56, 0.64, 1] as const;

/** Gentler pop — for smaller badges, subtle elements */
export const POP_SUBTLE = [0.34, 1.3, 0.64, 1] as const;

/** Calm reveal — for body text, paragraphs, text-heavy content */
export const EASE = [0.16, 1, 0.3, 1] as const;

/** Standard viewport config for scroll reveals */
export const VIEWPORT = { once: true, amount: 0.2 } as const;