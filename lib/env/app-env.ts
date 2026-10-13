// Deployment-target detection for SEO/indexing decisions.
//
// Indexing rules read NEXT_PUBLIC_APP_ENV — NOT the request hostname. A host
// check breaks as soon as a preview alias or custom domain points at a
// non-production build, and the brief requires env-based detection.
//
// Fail-closed: only an explicit `production` is treated as indexable. Anything
// else (uat, development, unset, typo) noindexes and disallows — so a missing
// env var can never leak a staging build into the search index. The cost of a
// misconfigured production env is a missing index, which verification on
// uat/production catches immediately; the cost of fail-open is permanent
// duplicate/staging content in Google.

export type AppEnv = 'production' | 'uat' | 'development' | 'unknown'

export function getAppEnv(): AppEnv {
  const raw = process.env.NEXT_PUBLIC_APP_ENV
  if (raw === 'production' || raw === 'uat' || raw === 'development') return raw
  return 'unknown'
}

/** True only for the production deployment. Every other env must noindex. */
export function isProductionEnv(): boolean {
  return getAppEnv() === 'production'
}

/** Per-page `robots` metadata — indexable in production only. */
export function indexingMeta(): { index: boolean; follow: boolean } {
  return isProductionEnv()
    ? { index: true, follow: true }
    : { index: false, follow: false }
}
