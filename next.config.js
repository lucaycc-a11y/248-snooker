const createNextIntlPlugin = require('next-intl/plugin')

const withNextIntl = createNextIntlPlugin('./i18n/request.ts')

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverComponentsExternalPackages: ['passkit-generator'],
  async headers() {
    const noindex = [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }]
    return [
      // Staging and preview deployments must never be indexed: uat.* shares
      // the production database (and its gate row), *.vercel.app mirrors prod.
      { source: '/:path*', has: [{ type: 'host', value: 'uat.space8.com.hk' }], headers: noindex },
      { source: '/:path*', has: [{ type: 'host', value: '(?<sub>.*)\\.vercel\\.app' }], headers: noindex },
      // Private areas: also disallowed in robots.txt; the header covers links
      // that reach them anyway (robots.txt alone does not prevent indexing).
      ...['/member', '/admin', '/auth', '/login'].flatMap((p) => [
        { source: p, headers: noindex },
        { source: `${p}/:path*`, headers: noindex },
      ]),
      // Password reset carries a token in its URL — never leak it as a referrer.
      {
        source: '/reset-password',
        headers: [
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
          { key: 'Cache-Control', value: 'no-store' },
        ],
      },

      // Static brand/media assets are content-stable: git history shows every
      // file under these trees is added once and never overwritten in place, so
      // a year of immutable caching cannot pin a stale edit. If a design asset
      // must change, change its filename.
      ...['/images', '/logos', '/video', '/gallery', '/fonts'].map((p) => ({
        source: `${p}/:path*`,
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      })),
    ]
  },
  async redirects() {
    const locales = ['zh-HK', 'zh-CN', 'en', 'ja']

    return [
      // Retired password pages → the single email-link reset flow (Part B2).
      // Query strings are preserved, so old recovery links still reach the form.
      { source: '/auth/update-password', destination: '/reset-password', permanent: false },
      { source: '/auth/change-password', destination: '/reset-password', permanent: false },
      { source: '/auth/reset-password', destination: '/reset-password', permanent: false },

      // /help → /faq (bare + locale-prefixed)
      {
        source: '/help',
        destination: '/faq',
        permanent: true,
        statusCode: 308,
      },
      ...locales.map((locale) => ({
        source: `/${locale}/help`,
        destination: `/${locale}/faq`,
        permanent: true,
        statusCode: 308,
      })),

      // /help/* → /faq (bare + locale-prefixed)
      {
        source: '/help/:path*',
        destination: '/faq',
        permanent: true,
        statusCode: 308,
      },
      ...locales.map((locale) => ({
        source: `/${locale}/help/:path*`,
        destination: `/${locale}/faq`,
        permanent: true,
        statusCode: 308,
      })),

      // /help-center and /help-center/* → /faq (bare + locale-prefixed)
      {
        source: '/help-center',
        destination: '/faq',
        permanent: true,
        statusCode: 308,
      },
      ...locales.map((locale) => ({
        source: `/${locale}/help-center`,
        destination: `/${locale}/faq`,
        permanent: true,
        statusCode: 308,
      })),
      {
        source: '/help-center/:path*',
        destination: '/faq',
        permanent: true,
        statusCode: 308,
      },
      ...locales.map((locale) => ({
        source: `/${locale}/help-center/:path*`,
        destination: `/${locale}/faq`,
        permanent: true,
        statusCode: 308,
      })),

      // /credits → / (bare + locale-prefixed)
      {
        source: '/credits',
        destination: '/',
        permanent: true,
        statusCode: 308,
      },
      ...locales.map((locale) => ({
        source: `/${locale}/credits`,
        destination: `/${locale}`,
        permanent: true,
        statusCode: 308,
      })),
    ]
  },
}

module.exports = withNextIntl(nextConfig)
