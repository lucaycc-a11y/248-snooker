const createNextIntlPlugin = require('next-intl/plugin')

const withNextIntl = createNextIntlPlugin('./i18n/request.ts')

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverComponentsExternalPackages: ['passkit-generator'],
  async headers() {
    return [
      // Password reset carries a token in its URL — never leak it as a referrer.
      {
        source: '/reset-password',
        headers: [
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
          { key: 'Cache-Control', value: 'no-store' },
        ],
      },
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

      // /help → /help-center (bare + locale-prefixed)
      {
        source: '/help',
        destination: '/help-center',
        permanent: true,
        statusCode: 308,
      },
      ...locales.map((locale) => ({
        source: `/${locale}/help`,
        destination: `/${locale}/help-center`,
        permanent: true,
        statusCode: 308,
      })),

      // /help/* → /help-center/* (bare + locale-prefixed)
      {
        source: '/help/:path*',
        destination: '/help-center/:path*',
        permanent: true,
        statusCode: 308,
      },
      ...locales.map((locale) => ({
        source: `/${locale}/help/:path*`,
        destination: `/${locale}/help-center/:path*`,
        permanent: true,
        statusCode: 308,
      })),

      // /faq → /help-center (bare + locale-prefixed)
      {
        source: '/faq',
        destination: '/help-center',
        permanent: true,
        statusCode: 308,
      },
      ...locales.map((locale) => ({
        source: `/${locale}/faq`,
        destination: `/${locale}/help-center`,
        permanent: true,
        statusCode: 308,
      })),
    ]
  },
}

module.exports = withNextIntl(nextConfig)
