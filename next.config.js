const createNextIntlPlugin = require('next-intl/plugin')

const withNextIntl = createNextIntlPlugin('./i18n/request.ts')

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverComponentsExternalPackages: ['passkit-generator'],
  async redirects() {
    const locales = ['zh-HK', 'zh-CN', 'en', 'ja']

    return [
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
