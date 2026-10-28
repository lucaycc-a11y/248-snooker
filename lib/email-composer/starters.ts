import { defaultDoc, newBlock, type ButtonBlock, type EmailDoc, type HeadingBlock, type TextBlock, type BigNumberBlock } from './doc'

// Built-in starting points shown beside the admin's saved templates. No prices, dates or offers are
// baked in — the admin fills those in (or asks Spark to).
const h = (text: string): HeadingBlock => ({ ...(newBlock('heading') as HeadingBlock), text })
const t = (text: string, muted = false): TextBlock => ({ ...(newBlock('text') as TextBlock), text, muted })
const btn = (label: string, href = 'https://space8.com.hk/book'): ButtonBlock => ({ ...(newBlock('button') as ButtonBlock), label, href })

function make(subject: string, preheader: string, blocks: EmailDoc['blocks']): EmailDoc {
  return { ...defaultDoc(), subject, preheader, blocks: [newBlock('logo'), ...blocks] }
}

export type Starter = { key: string; name: string; hint: string; doc: () => EmailDoc }

export const STARTERS: Starter[] = [
  {
    key: 'announce', name: '最新消息／公告', hint: '網站、營業或新功能通知',
    doc: () => make('Space8 最新消息', '有件事想同你分享', [
      h('Hi {{name}}'), t('我們有一個小更新想同你分享。\n在這裡寫重點內容。'), btn('立即預約'),
    ]),
  },
  {
    key: 'welcome', name: '歡迎新會員', hint: '新會員第一封電郵',
    doc: () => make('歡迎加入 Space8', '你的會員帳戶已準備好', [
      h('歡迎，{{name}}'), t('多謝你加入 Space8。預約私人枱、累積積分，都可以喺會員頁完成。'),
      { ...(newBlock('bignumber') as BigNumberBlock), label: 'WELCOME', value: '—', unit: '' }, btn('預約第一次'),
    ]),
  },
  {
    key: 'promo', name: '優惠碼推廣', hint: '附優惠碼嘅宣傳電郵',
    doc: () => make('專屬優惠，送俾你', '限時優惠碼', [
      h('{{name}}，有份禮物'), t('在這裡寫優惠內容、使用條件同限期。'),
      { ...(newBlock('bignumber') as BigNumberBlock), label: 'PROMO CODE', value: 'CODE', unit: '' }, btn('用優惠碼預約'),
      t('如不想收到此類電郵，請回覆此信。', true),
    ]),
  },
  {
    key: 'event', name: '活動邀請', hint: '比賽、活動或特別時段',
    doc: () => make('Space8 活動邀請', '誠邀你參加', [
      h('誠邀你參加'), t('在這裡寫活動名稱、日期、地點同報名方法。'), btn('了解詳情'),
    ]),
  },
]
