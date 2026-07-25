// Shared FAQ content — single source of truth for both the rendered list
// and the JSON-LD structured data, so they can never drift apart.

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

// Rule-type answers embed markdown-style links ([label](/path)) that FAQ.tsx
// renders as real locale-aware <Link>s. JSON-LD wants plain text, so strip
// the syntax down to just the label there.
export function stripMarkdownLinks(text: string): string {
  return text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
}

export function getFaqItems(t: (key: string) => string): FaqItem[] {
  return [
    { id: "faq-booking",   question: t('faq_booking_q'),   answer: t('faq_booking_a') },
    { id: "faq-entry",     question: t('faq_entry_q'),     answer: t('faq_entry_a') },
    { id: "faq-smoking",   question: t('faq_smoking_q'),   answer: t('faq_smoking_a') },
    { id: "faq-cancel",    question: t('faq_cancel_q'),    answer: t('faq_cancel_a') },
    { id: "faq-hours",     question: t('faq_hours_q'),     answer: t('faq_hours_a') },
    { id: "faq-pricing",   question: t('faq_pricing_q'),   answer: t('faq_pricing_a') },
    { id: "faq-points",    question: t('faq_points_q'),    answer: t('faq_points_a') },
    { id: "faq-facilities",question: t('faq_facilities_q'),answer: t('faq_facilities_a') },
    { id: "faq-guests",    question: t('faq_guests_q'),    answer: t('faq_guests_a') },
    { id: "faq-weather",   question: t('faq_weather_q'),   answer: t('faq_weather_a') },
    { id: "faq-overtime",  question: t('faq_overtime_q'),  answer: t('faq_overtime_a') },
    { id: "faq-contact",   question: t('faq_contact_q'),   answer: t('faq_contact_a') },
  ];
}

// Homepage shows a curated 5-item subset (see components/landing/FAQ.tsx);
// the full list above lives on /faq. Kept here so both the subset order and
// the "learn more" affordance stay in one source of truth.
export const HOMEPAGE_FAQ_IDS = [
  "faq-booking",
  "faq-entry",
  "faq-smoking",
  "faq-weather",
  "faq-contact",
] as const;

// JSON-LD FAQPage structured data, derived from the same source. Pass `ids`
// to emit structured data for only a curated subset (so the homepage's
// FAQPage schema matches the 5 items it actually renders).
export function getFaqJsonLd(t: (key: string) => string, ids?: readonly string[]) {
  const all = getFaqItems(t);
  const items = ids
    ? ids
        .map((id) => all.find((item) => item.id === id))
        .filter((item): item is FaqItem => item !== undefined)
    : all;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: stripMarkdownLinks(item.answer),
      },
    })),
  };
}
