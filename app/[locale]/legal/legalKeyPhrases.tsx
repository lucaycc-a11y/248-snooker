// Key-phrase bold-highlighting for the /legal page — rendering-layer only.
//
// IMPORTANT: this file does not alter a single character of the verbatim
// legal text in content/legal/*.ts. It only lists exact substrings of that
// text (amounts, deadlines, consequence phrases, trigger conditions,
// obligation phrases) that LegalContent.tsx wraps in <strong> at render
// time via highlightKeyPhrases(). If a phrase here ever stops being an
// exact substring of the source (e.g. the legal text is edited later),
// it silently just won't match — it can never inject or change wording.
//
// Phrases are matched longest-first so a shorter phrase can never fragment
// a longer one that contains it.

import type { Locale } from "@/i18n/routing";

const ZH_HK: string[] = [
  // amounts
  "港幣 $300 元",
  // deadlines / time limits
  "10 分鐘內",
  "5 分鐘",
  "24 小時",
  "7天內",
  "6人",
  "十二（12）歲",
  // trigger conditions
  "8號或以上颱風信號",
  "黑色暴雨警告信號",
  // consequence phrases
  "不可撤銷",
  "一律不設取消、改期或退款",
  "概不承擔任何法律或賠償責任",
  "全部法律及賠償責任",
  "即時暫停或永久註銷",
  "本公司不作任何退款",
  "不作任何退款",
  "且不作任何形式的補償或退款",
  "並保留追究違約金的權利",
  "保留法律追訴權",
  "暫停或終止該帳戶之權利",
  "不得複製、修改、發佈或用於商業用途",
  "不會直接儲存閣下完整信用卡號碼",
  "不會將閣下之個人資料出售予任何第三方",
  "不會於自身伺服器直接儲存閣下完整之信用卡號碼",
  // obligation phrases
  "必須於原定預約時段開始前",
];

const ZH_CN: string[] = [
  "港币 $300 元",
  "10 分钟内",
  "5 分钟",
  "24 小时",
  "7天内",
  "6人",
  "十二（12）岁",
  "8号或以上台风信号",
  "黑色暴雨警告信号",
  "不可撤销",
  "一律不设取消、改期或退款",
  "概不承担任何法律或赔偿责任",
  "全部法律及赔偿责任",
  "即时暂停或永久注销",
  "本公司不作任何退款",
  "不作任何退款",
  "且不作任何形式的补偿或退款",
  "并保留追究违约金的权利",
  "保留法律追诉权",
  "暂停或终止该帐户之权利",
  "不得复制、修改、发布或用于商业用途",
  "不会直接储存阁下完整信用卡号码",
  "不会将阁下之个人资料出售予任何第三方",
  "不会于自身服务器直接储存阁下完整之信用卡号码",
  "必须于原定预约时段开始前",
];

const EN: string[] = [
  "HK$300",
  "within 10 minutes",
  "more than 5 minutes",
  "24-hour",
  "within 7 days",
  "strictly limited to 6",
  "twelve (12)",
  "Typhoon Signal No. 8 or above",
  "Black Rainstorm Warning Signal",
  "hereby irrevocably agree",
  "non-cancellable, non-reschedulable, and non-refundable",
  "shall bear no legal or compensatory liability whatsoever",
  "full legal and compensatory liability",
  "immediately suspend or permanently cancel",
  "will not issue any refund",
  "without any refund",
  "without any form of compensation or refund",
  "reserves the right to pursue liquidated damages",
  "reserves the right to pursue legal action",
  "suspend or terminate an account",
  "without prior written consent",
  "does not directly store your complete credit card number",
  "will not sell your personal data to any third party",
  "automatically deduct an overtime charge",
  "before the start of your originally booked time slot",
];

const PHRASES_BY_LOCALE: Record<Locale, string[]> = {
  "zh-HK": ZH_HK,
  "zh-CN": ZH_CN,
  en: EN,
};

// Longest-first per locale so a shorter listed phrase can never fragment a
// longer one that contains it (e.g. "不作任何退款" vs "且不作任何形式的補償或退款").
const SORTED_BY_LOCALE: Partial<Record<Locale, string[]>> = {};

function getSortedPhrases(locale: Locale): string[] {
  const cached = SORTED_BY_LOCALE[locale];
  if (cached) return cached;
  const sorted = [...(PHRASES_BY_LOCALE[locale] ?? [])].sort((a, b) => b.length - a.length);
  SORTED_BY_LOCALE[locale] = sorted;
  return sorted;
}

/**
 * Splits `text` into React nodes, wrapping any exact-substring matches from
 * the locale's key-phrase list in <strong>. Never alters the text itself —
 * every character of `text` is preserved, only markup is added around
 * pre-existing substrings.
 */
export function highlightKeyPhrases(text: string, locale: Locale): React.ReactNode[] {
  const phrases = getSortedPhrases(locale);
  if (phrases.length === 0) return [text];

  // Single pass: at each position, try each phrase (longest-first); on a
  // match emit a <strong>, otherwise advance one character at a time,
  // accumulating a plain-text run to minimise the number of React nodes.
  const nodes: React.ReactNode[] = [];
  let plainStart = 0;
  let i = 0;
  let key = 0;

  const flushPlain = (end: number) => {
    if (end > plainStart) {
      nodes.push(text.slice(plainStart, end));
    }
  };

  while (i < text.length) {
    const match = phrases.find((p) => text.startsWith(p, i));
    if (match) {
      flushPlain(i);
      nodes.push(<strong key={`b-${key++}`}>{match}</strong>);
      i += match.length;
      plainStart = i;
    } else {
      i += 1;
    }
  }
  flushPlain(text.length);

  return nodes;
}
