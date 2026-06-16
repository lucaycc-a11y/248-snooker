// Shared FAQ content — single source of truth for both the rendered list
// and the JSON-LD structured data, so they can never drift apart.

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export const faqItems: FaqItem[] = [
  {
    id: "faq-booking",
    question: "如何預訂球桌？",
    answer:
      "選擇日期、時段及時長，以 Apple Pay 或信用卡即時付款，確認後即獲 QR 碼。全程不需人手協助。",
  },
  {
    id: "faq-entry",
    question: "預訂後如何入場？",
    answer:
      "付款確認後，你將收到專屬 QR 碼。到場掃描門口感應器，系統自動開門，全程自助。",
  },
  {
    id: "faq-cancel",
    question: "可以即場取消嗎？",
    answer: "開始前 2 小時內可免費取消，全額退款。逾時取消將不獲退款。",
  },
  {
    id: "faq-hours",
    question: "營業時間是什麼？",
    answer: "248 桌球會全年 24 小時營業，包括公眾假期。",
  },
  {
    id: "faq-minimum",
    question: "每次最少預訂多少時間？",
    answer: "最少 1 小時，可選 1、2 或 3 小時。",
  },
  {
    id: "faq-pricing",
    question: "收費如何計算？",
    answer:
      "下午（12pm–6pm）及深夜（12am–6am）每小時 HK$60；晚上（6pm–12am）每小時 HK$80。",
  },
  {
    id: "faq-points",
    question: "什麼是積分制度？",
    answer:
      "每消費 HK$1 賺取 1 積分。累積至 500 分升級 Century，享 9 折及積分 1.5 倍；累積至 1,500 分升級 Maximum，享 8 折及免費教練時段。",
  },
  {
    id: "faq-facilities",
    question: "場地內有什麼設備？",
    answer:
      "專業桌球枱、頂級燈光設備、冷氣、免費 Wi-Fi，以及自助飲品區。",
  },
  {
    id: "faq-guests",
    question: "可以帶朋友一起來嗎？",
    answer:
      "可以，每個時段可容納多人，費用按時段計算，無需額外收費。",
  },
  {
    id: "faq-contact",
    question: "如有問題如何聯絡？",
    answer:
      "可透過 WhatsApp 聯絡我們，或發送電郵至 hello@formhk.com，我們將盡快回覆。",
  },
];

// JSON-LD FAQPage structured data, derived from the same source.
export const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqItems.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.answer,
    },
  })),
};
