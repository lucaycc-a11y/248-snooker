// Shared FAQ content — single source of truth for both the rendered list
// and the JSON-LD structured data, so they can never drift apart.

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export function getFaqItems(t: (key: string) => string): FaqItem[] {
  return [
    { id: "faq-booking",   question: t('faq_booking_q'),   answer: t('faq_booking_a') },
    { id: "faq-entry",     question: t('faq_entry_q'),     answer: t('faq_entry_a') },
    { id: "faq-cancel",    question: t('faq_cancel_q'),    answer: t('faq_cancel_a') },
    { id: "faq-hours",     question: t('faq_hours_q'),     answer: t('faq_hours_a') },
    { id: "faq-minimum",   question: t('faq_minimum_q'),   answer: t('faq_minimum_a') },
    { id: "faq-pricing",   question: t('faq_pricing_q'),   answer: t('faq_pricing_a') },
    { id: "faq-points",    question: t('faq_points_q'),    answer: t('faq_points_a') },
    { id: "faq-facilities",question: t('faq_facilities_q'),answer: t('faq_facilities_a') },
    { id: "faq-guests",    question: t('faq_guests_q'),    answer: t('faq_guests_a') },
    { id: "faq-contact",   question: t('faq_contact_q'),   answer: t('faq_contact_a') },
  ];
}

// JSON-LD FAQPage structured data, derived from the same source.
export function getFaqJsonLd(t: (key: string) => string) {
  const items = getFaqItems(t);
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}
