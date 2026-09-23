import type { HelpArticleSlug, HelpArticleContent } from './types'

// Entry QR
import { entryQrZhHK } from './entry-qr.zh-HK'
import { entryQrZhCN } from './entry-qr.zh-CN'
import { entryQrEn } from './entry-qr.en'

// Booking
import { bookingZhHK } from './booking.zh-HK'
import { bookingZhCN } from './booking.zh-CN'
import { bookingEn } from './booking.en'

// Account Login
import { accountLoginZhHK } from './account-login.zh-HK'
import { accountLoginZhCN } from './account-login.zh-CN'
import { accountLoginEn } from './account-login.en'

// Find QR
import { findQrZhHK } from './find-qr.zh-HK'
import { findQrZhCN } from './find-qr.zh-CN'
import { findQrEn } from './find-qr.en'

// Tier Points
import { tierPointsZhHK } from './tier-points.zh-HK'
import { tierPointsZhCN } from './tier-points.zh-CN'
import { tierPointsEn } from './tier-points.en'

// Cancellation Policy
import { cancellationPolicyZhHK } from './cancellation-policy.zh-HK'
import { cancellationPolicyZhCN } from './cancellation-policy.zh-CN'
import { cancellationPolicyEn } from './cancellation-policy.en'

// Special Weather
import { specialWeatherZhHK } from './special-weather.zh-HK'
import { specialWeatherZhCN } from './special-weather.zh-CN'
import { specialWeatherEn } from './special-weather.en'

// Contact Support
import { contactSupportZhHK } from './contact-support.zh-HK'
import { contactSupportZhCN } from './contact-support.zh-CN'
import { contactSupportEn } from './contact-support.en'

type Locale = 'zh-HK' | 'zh-CN' | 'en' | 'ja'

const contentMap: Record<HelpArticleSlug, Record<Locale, HelpArticleContent>> = {
  'entry-qr': {
    'zh-HK': entryQrZhHK,
    'zh-CN': entryQrZhCN,
    'en': entryQrEn,
    'ja': entryQrEn, // Fallback to English for now
  },
  'booking': {
    'zh-HK': bookingZhHK,
    'zh-CN': bookingZhCN,
    'en': bookingEn,
    'ja': bookingEn,
  },
  'account-login': {
    'zh-HK': accountLoginZhHK,
    'zh-CN': accountLoginZhCN,
    'en': accountLoginEn,
    'ja': accountLoginEn,
  },
  'find-qr': {
    'zh-HK': findQrZhHK,
    'zh-CN': findQrZhCN,
    'en': findQrEn,
    'ja': findQrEn,
  },
  'tier-points': {
    'zh-HK': tierPointsZhHK,
    'zh-CN': tierPointsZhCN,
    'en': tierPointsEn,
    'ja': tierPointsEn,
  },
  'cancellation-policy': {
    'zh-HK': cancellationPolicyZhHK,
    'zh-CN': cancellationPolicyZhCN,
    'en': cancellationPolicyEn,
    'ja': cancellationPolicyEn,
  },
  'special-weather': {
    'zh-HK': specialWeatherZhHK,
    'zh-CN': specialWeatherZhCN,
    'en': specialWeatherEn,
    'ja': specialWeatherEn,
  },
  'contact-support': {
    'zh-HK': contactSupportZhHK,
    'zh-CN': contactSupportZhCN,
    'en': contactSupportEn,
    'ja': contactSupportEn,
  },
}

export function getHelpArticleContent(
  slug: HelpArticleSlug,
  locale: Locale = 'zh-HK'
): HelpArticleContent {
  const articleLocales = contentMap[slug]
  if (!articleLocales) {
    throw new Error(`Help article not found: ${slug}`)
  }

  return articleLocales[locale] || articleLocales['zh-HK']
}
