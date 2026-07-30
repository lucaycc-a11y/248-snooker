import type { Locale } from '@/i18n/routing'
import type { LegalDocument } from './types'
import { termsZhHK } from './terms.zh-HK'
import { termsZhCN } from './terms.zh-CN'
import { termsEn } from './terms.en'
import { websiteTermsZhHK } from './website-terms.zh-HK'
import { websiteTermsZhCN } from './website-terms.zh-CN'
import { websiteTermsEn } from './website-terms.en'
import { privacyZhHK } from './privacy.zh-HK'
import { privacyZhCN } from './privacy.zh-CN'
import { privacyEn } from './privacy.en'

// Registry of the 3 legal documents × 3 locales = 9 static files. zh-HK is
// the canonical source; zh-CN and en are faithful 1:1 translations (same
// section count/structure, translated by a human-reviewed pass — never
// machine-summarized). No ja variant exists (ja was dropped site-wide).
//
// These are plain build-time constants — no runtime DB fetch. See
// content/legal/verify-section-counts.ts for the structural parity check
// that must pass across all 3 locales for each document.

export type LegalDocId = 'terms' | 'website_terms' | 'privacy'

const REGISTRY: Record<LegalDocId, Record<Locale, LegalDocument>> = {
  terms: {
    'zh-HK': termsZhHK,
    'zh-CN': termsZhCN,
    en: termsEn,
  },
  website_terms: {
    'zh-HK': websiteTermsZhHK,
    'zh-CN': websiteTermsZhCN,
    en: websiteTermsEn,
  },
  privacy: {
    'zh-HK': privacyZhHK,
    'zh-CN': privacyZhCN,
    en: privacyEn,
  },
}

export function getLegalDocument(docId: LegalDocId, locale: Locale): LegalDocument {
  return REGISTRY[docId][locale] ?? REGISTRY[docId]['zh-HK']
}

export function getAllLegalDocuments(locale: Locale): Record<LegalDocId, LegalDocument> {
  return {
    terms: getLegalDocument('terms', locale),
    website_terms: getLegalDocument('website_terms', locale),
    privacy: getLegalDocument('privacy', locale),
  }
}
