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
import { accessibilityZhHK } from './accessibility.zh-HK'
import { accessibilityZhCN } from './accessibility.zh-CN'
import { accessibilityEn } from './accessibility.en'
import { refundPolicyZhHK } from './refund-policy.zh-HK'
import { refundPolicyZhCN } from './refund-policy.zh-CN'
import { refundPolicyEn } from './refund-policy.en'
import { deliveryPolicyZhHK } from './delivery-policy.zh-HK'
import { deliveryPolicyZhCN } from './delivery-policy.zh-CN'
import { deliveryPolicyEn } from './delivery-policy.en'
import { brandStatementZhHK } from './brand-statement.zh-HK'
import { brandStatementZhCN } from './brand-statement.zh-CN'
import { brandStatementEn } from './brand-statement.en'

// Registry of the 6 legal documents × 3 locales = 18 static files. zh-HK is
// the canonical source; zh-CN and en are faithful 1:1 translations (same
// section count/structure, translated by a human-reviewed pass — never
// machine-summarized). No ja variant exists (ja was dropped site-wide).
//
// These are plain build-time constants — no runtime DB fetch. See
// content/legal/verify-section-counts.ts for the structural parity check
// that must pass across all 3 locales for each document.

export type LegalDocId = 'terms' | 'website_terms' | 'privacy' | 'accessibility' | 'refund_policy' | 'delivery_policy' | 'brand_statement'

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
  accessibility: {
    'zh-HK': accessibilityZhHK,
    'zh-CN': accessibilityZhCN,
    en: accessibilityEn,
  },
  refund_policy: {
    'zh-HK': refundPolicyZhHK,
    'zh-CN': refundPolicyZhCN,
    en: refundPolicyEn,
  },
  delivery_policy: {
    'zh-HK': deliveryPolicyZhHK,
    'zh-CN': deliveryPolicyZhCN,
    en: deliveryPolicyEn,
  },
  brand_statement: {
    'zh-HK': brandStatementZhHK,
    'zh-CN': brandStatementZhCN,
    en: brandStatementEn,
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
    accessibility: getLegalDocument('accessibility', locale),
    refund_policy: getLegalDocument('refund_policy', locale),
    delivery_policy: getLegalDocument('delivery_policy', locale),
    brand_statement: getLegalDocument('brand_statement', locale),
  }
}
