// One-time seed script: walks messages/*.json and emits SQL INSERT statements
// for every CMSText key + cms_list_items row currently rendered on the
// public site, so cms_content/cms_list_items are populated before the first
// visitor arrives — real seeding via app/api/cms/seed/route.ts only happens
// as pages render client-side, which doesn't help "populated before traffic".
//
// This is a build-time script (not a live API route) specifically because
// the spec's literal "seed-all route" idea doesn't work: SSR doesn't run the
// client-side useEffect that triggers a seed POST, so a server-side crawl of
// every page would silently seed nothing. Walking the message JSON directly
// is the reliable equivalent.
//
// Usage: node scripts/cms-seed-from-messages.mjs > supabase/migrations/0021_cms_seed_data.sql
// (Or write to a file with `> path` and review before running in the SQL editor.)

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const LOCALES = ['zh-HK', 'zh-CN', 'en']

function loadMessages(locale) {
  return JSON.parse(readFileSync(join(ROOT, 'messages', `${locale}.json`), 'utf8'))
}

function sqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`
}

// ── cms_content: explicit (cmsKey, namespace, messageKey) tuples ──────────
// Hand-enumerated from every literal CMSText call site (grepped across the
// codebase) rather than derived by pattern-matching JSX, since a regex-based
// extractor can't reliably resolve dynamic keys built from runtime arrays
// (stage.id, card.key, etc.) without also parsing the array literals.
const SCALAR_KEYS = [
  // hero
  ['hero.tagline', 'hero', 'tagline'],
  ['hero.cta_book', 'hero', 'cta_book'],
  ['hero.cta_learn', 'hero', 'cta_learn'],
  // pricing (landing section)
  ['pricing.afternoon_label', 'pricing', 'afternoon_label'],
  ['pricing.afternoon_range', 'pricing', 'afternoon_range'],
  ['pricing.evening_label', 'pricing', 'evening_label'],
  ['pricing.evening_range', 'pricing', 'evening_range'],
  ['pricing.latenight_label', 'pricing', 'night_label'],
  ['pricing.latenight_range', 'pricing', 'night_range'],
  ['pricing.duration_1h', 'pricing', 'duration_1h'],
  ['pricing.duration_2h', 'pricing', 'duration_2h'],
  ['pricing.duration_3h', 'pricing', 'duration_3h'],
  ['pricing.per_hour', 'pricing', 'per_hour'],
  ['pricing.cta_book', 'pricing', 'cta_book'],
  ['pricing.cta_learn', 'pricing', 'cta_learn'],
  ['pricing.title', 'pricing', 'title'],
  // how it works
  ['how.title', 'how', 'title'],
  ['how.step_book_title', 'how', 'step1_title'],
  ['how.step_qr_title', 'how', 'step2_title'],
  ['how.step_points_title', 'how', 'step3_title'],
  // member
  ['member.title', 'member', 'title'],
  ['member.cta_join', 'member', 'cta_join'],
  ['member.cta_learn', 'member', 'cta_learn'],
  ['member.tier_amateur_title', 'member', 'amateur_title'],
  ['member.tier_century_title', 'member', 'century_title'],
  ['member.tier_century_subtitle', 'member', 'century_subtitle'],
  ['member.tier_maximum_title', 'member', 'maximum_title'],
  ['member.tier_maximum_subtitle', 'member', 'maximum_subtitle'],
  ['member.tier_maximum_badge', 'member', 'maximum_badge'],
  // gallery
  ['gallery.title', 'gallery', 'title'],
  // faq (section title only — items are cms_list_items)
  ['faq.title', 'faq', 'title'],
  // blog
  ['blog.title', 'blog', 'title'],
  ['blog.subtitle', 'blog', 'subtitle'],
  ['blog.filter_all', 'blog', 'filter_all'],
  ['blog.filter_tutorial', 'blog', 'filter_tutorial'],
  ['blog.filter_venue', 'blog', 'filter_venue'],
  ['blog.filter_event', 'blog', 'filter_event'],
  ['blog.filter_culture', 'blog', 'filter_culture'],
  ['blog.read_time', 'blog', 'read_time'],
  ['blog.coming_soon_title', 'blog', 'coming_soon_title'],
  ['blog.coming_soon_body', 'blog', 'coming_soon_body'],
  ['blog.newsletter_button', 'blog', 'newsletter_button'],
  ['blog.back_to_blog', 'blog', 'back_to_blog'],
  ['blog.related_title', 'blog', 'related_title'],
  // about page (namespace: aboutPage)
  ['aboutPage.hero_title', 'aboutPage', 'hero_title'],
  ['aboutPage.hero_subtitle', 'aboutPage', 'hero_subtitle'],
  ['aboutPage.mission_eyebrow', 'aboutPage', 'mission_eyebrow'],
  ['aboutPage.mission_statement', 'aboutPage', 'mission_statement'],
  ['aboutPage.story_title', 'aboutPage', 'story_title'],
  ['aboutPage.story_body', 'aboutPage', 'story_body'],
  ['aboutPage.venue_title', 'aboutPage', 'venue_title'],
  ['aboutPage.contact_title', 'aboutPage', 'contact_title'],
  ['aboutPage.contact_cta', 'aboutPage', 'contact_cta'],
  ['aboutPage.contact_address_label', 'aboutPage', 'contact_address_label'],
  ['aboutPage.contact_whatsapp_label', 'aboutPage', 'contact_whatsapp_label'],
  ['aboutPage.contact_email_label', 'aboutPage', 'contact_email_label'],
  ['aboutPage.contact_hours_label', 'aboutPage', 'contact_hours_label'],
  // pricing page (namespace: pricingPage)
  ['pricingPage.hero_title', 'pricingPage', 'hero_title'],
  ['pricingPage.hero_subtitle', 'pricingPage', 'hero_subtitle'],
  ['pricingPage.per_hour_suffix', 'pricingPage', 'per_hour'],
  ['pricingPage.duration_1h', 'pricingPage', 'duration_1h'],
  ['pricingPage.duration_2h', 'pricingPage', 'duration_2h'],
  ['pricingPage.duration_3h', 'pricingPage', 'duration_3h'],
  ['pricingPage.cta_book', 'pricingPage', 'cta_book'],
  ['pricingPage.cta_details', 'pricingPage', 'cta_details'],
  ['pricingPage.breakdown_title', 'pricingPage', 'breakdown_title'],
  ['pricingPage.breakdown_period', 'pricingPage', 'breakdown_period'],
  ['pricingPage.breakdown_time', 'pricingPage', 'breakdown_time'],
  ['pricingPage.breakdown_rate', 'pricingPage', 'breakdown_rate'],
  ['pricingPage.per_hour', 'pricingPage', 'per_hour'],
  ['pricingPage.benefits_title', 'pricingPage', 'benefits_title'],
  ['pricingPage.services_title', 'pricingPage', 'services_title'],
  ['pricingPage.faq_title', 'pricingPage', 'faq_title'],
  ['pricingPage.cta_section_title', 'pricingPage', 'cta_section_title'],
  ['pricingPage.cta_section_button', 'pricingPage', 'cta_section_button'],
  ['pricingPage.period.afternoon.title', 'pricingPage', 'period_afternoon_title'],
  ['pricingPage.period.afternoon.time', 'pricingPage', 'period_afternoon_time'],
  ['pricingPage.period.evening.title', 'pricingPage', 'period_evening_title'],
  ['pricingPage.period.evening.time', 'pricingPage', 'period_evening_time'],
  ['pricingPage.period.latenight.title', 'pricingPage', 'period_latenight_title'],
  ['pricingPage.period.latenight.time', 'pricingPage', 'period_latenight_time'],
  ['pricingPage.breakdown.afternoon.name', 'pricingPage', 'period_afternoon_title'],
  ['pricingPage.breakdown.afternoon.time', 'pricingPage', 'period_afternoon_time'],
  ['pricingPage.breakdown.evening.name', 'pricingPage', 'period_evening_title'],
  ['pricingPage.breakdown.evening.time', 'pricingPage', 'period_evening_time'],
  ['pricingPage.breakdown.latenight.name', 'pricingPage', 'period_latenight_title'],
  ['pricingPage.breakdown.latenight.time', 'pricingPage', 'period_latenight_time'],
  // legal
  ['legal.title', 'legal', 'title'],
  ['legal.subtitle', 'legal', 'subtitle'],
  ['legal.last_updated', 'legal', 'last_updated'],
  ['legal.tab_terms', 'legal', 'tab_terms'],
  ['legal.tab_privacy', 'legal', 'tab_privacy'],
  ['legal.tab_refund', 'legal', 'tab_refund'],
  ['legal.tab_rules', 'legal', 'tab_rules'],
  ['legal.refund.head.case', 'legal', 'refund_table_case'],
  ['legal.refund.head.result', 'legal', 'refund_table_result'],
  ['legal.refund.times.title', 'legal', 'refund_times_title'],
  ['legal.rules.allowed.title', 'legal', 'rules_allowed_title'],
  ['legal.rules.prohibited.title', 'legal', 'rules_prohibited_title'],
  ['legal.rules.notes.title', 'legal', 'rules_notes_title'],
  // book
  ['book.fully_booked', 'book', 'fully_booked'],
  ['book.select_table', 'book', 'select_table'],
  ['book.table_label', 'book', 'table_label'],
  ['book.card.title', 'book', 'your_booking'],
  ['book.date', 'book', 'date'],
  ['book.time_slot', 'book', 'time_slot'],
  ['book.duration', 'book', 'duration'],
  ['book.date.title', 'book', 'select_date'],
  ['book.time.title', 'book', 'start_time'],
  ['book.hint', 'book', 'instant_confirm'],
  ['book.max_hours_reached', 'book', 'max_hours_reached'],
  ['book.slots_selected', 'book', 'slots_selected'],
  ['book.remove_slot', 'book', 'remove_slot'],
  ['book.continue', 'book', 'continue'],
  ['book.auth.title', 'book', 'login_title'],
  ['book.auth.subtitle', 'book', 'login_subtitle'],
  ['book.pay.subtotal', 'book', 'subtotal'],
  ['book.pay.fee', 'book', 'service_fee'],
  ['book.pay.total', 'book', 'total'],
  ['book.pay.method', 'book', 'payment_title'],
  ['book.payment_reminder', 'book', 'payment_reminder'],
  ['book.pay.secure', 'book', 'stripe_secure'],
  ['book.ticket.confirmed', 'book', 'confirm_title'],
  ['book.ticket.member_cta', 'book', 'go_to_member'],
  ['book.ticket.home', 'book', 'back_home'],
  ['book.pay.confirm_failed', 'book', 'confirm_failed'],
  ['book.pay.confirm_failed_home', 'book', 'back_home'],
  ['book.pay.confirming', 'book', 'confirming'],
  ['book.leave.title', 'book', 'leave_title'],
  ['book.leave.body', 'book', 'leave_body'],
  ['book.leave.confirm', 'book', 'leave_confirm'],
  ['book.leave.stay', 'book', 'leave_stay'],
]

function get(obj, path) {
  return path.split('.').reduce((acc, key) => (acc && typeof acc === 'object' ? acc[key] : undefined), obj)
}

function generateCmsContentInserts() {
  const rows = []
  for (const locale of LOCALES) {
    const messages = loadMessages(locale)
    for (const [cmsKey, namespace, messageKey] of SCALAR_KEYS) {
      const value = get(messages, `${namespace}.${messageKey}`)
      if (typeof value !== 'string') {
        console.error(`# WARNING: ${locale}.json missing ${namespace}.${messageKey} (cms key ${cmsKey}) — skipped`)
        continue
      }
      rows.push(
        `(${sqlString(cmsKey)}, ${sqlString(locale)}, ${sqlString(value)})`
      )
    }
  }
  if (rows.length === 0) return ''
  return [
    '-- cms_content: scalar CMSText keys, one row per (key, locale).',
    'INSERT INTO public.cms_content (key, locale, value) VALUES',
    rows.join(',\n') + '',
    'ON CONFLICT (key, locale) DO NOTHING;',
    '',
  ].join('\n')
}

// ── cms_list_items: FAQ + legal terms/privacy sections ─────────────────────

const FAQ_KEYS = [
  'faq_booking', 'faq_entry', 'faq_cancel', 'faq_hours', 'faq_minimum',
  'faq_pricing', 'faq_points', 'faq_facilities', 'faq_guests', 'faq_contact',
]

function generateFaqListInserts() {
  const rows = []
  for (const locale of LOCALES) {
    const messages = loadMessages(locale)
    FAQ_KEYS.forEach((key, i) => {
      const question = get(messages, `faq.${key}_q`)
      const answer = get(messages, `faq.${key}_a`)
      if (typeof question !== 'string' || typeof answer !== 'string') {
        console.error(`# WARNING: ${locale}.json missing faq.${key}_q/_a — skipped`)
        return
      }
      const fields = JSON.stringify({ question, answer }).replace(/'/g, "''")
      rows.push(`('faq', 'faq_items', ${sqlString(locale)}, ${i}, '${fields}'::jsonb, 'published')`)
    })
  }
  if (rows.length === 0) return ''
  return [
    '-- cms_list_items: FAQ entries, one row per (locale, item).',
    'DO $$',
    'BEGIN',
    "  IF NOT EXISTS (SELECT 1 FROM public.cms_list_items WHERE page = 'faq' AND collection_key = 'faq_items') THEN",
    '    INSERT INTO public.cms_list_items (page, collection_key, locale, order_index, fields, status) VALUES',
    '    ' + rows.join(',\n    ') + ';',
    '  END IF;',
    'END $$;',
    '',
  ].join('\n')
}

function generateLegalSectionInserts(collectionKey) {
  const rows = []
  for (const locale of LOCALES) {
    const messages = loadMessages(locale)
    const sections = get(messages, `legal.${collectionKey}`)
    if (!Array.isArray(sections)) {
      console.error(`# WARNING: ${locale}.json missing legal.${collectionKey} — skipped`)
      continue
    }
    sections.forEach((section, i) => {
      const fields = JSON.stringify({ title: section.title, body: section.body }).replace(/'/g, "''")
      rows.push(`('legal', '${collectionKey}', ${sqlString(locale)}, ${i}, '${fields}'::jsonb, 'published')`)
    })
  }
  if (rows.length === 0) return ''
  return [
    `-- cms_list_items: legal.${collectionKey}, one row per (locale, section).`,
    'DO $$',
    'BEGIN',
    `  IF NOT EXISTS (SELECT 1 FROM public.cms_list_items WHERE page = 'legal' AND collection_key = '${collectionKey}') THEN`,
    '    INSERT INTO public.cms_list_items (page, collection_key, locale, order_index, fields, status) VALUES',
    '    ' + rows.join(',\n    ') + ';',
    '  END IF;',
    'END $$;',
    '',
  ].join('\n')
}

console.log('-- Generated by scripts/cms-seed-from-messages.mjs — DO NOT hand-edit.')
console.log('-- Seeds cms_content + cms_list_items from the current messages/*.json,')
console.log('-- so live content is populated before the first visitor triggers a')
console.log('-- client-side seed. Idempotent: ON CONFLICT DO NOTHING / existence checks.')
console.log('')
console.log(generateCmsContentInserts())
console.log(generateFaqListInserts())
console.log(generateLegalSectionInserts('terms_sections'))
console.log(generateLegalSectionInserts('privacy_sections'))
