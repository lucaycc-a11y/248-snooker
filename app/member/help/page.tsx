'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { QRCodeSVG } from 'qrcode.react'

// ════════════════════════════════════════════════════════════════════════════
// Help Page — FAQ with refund policy + QR code shortcut + WhatsApp contact
// All refund content verified from 退款政策
// ════════════════════════════════════════════════════════════════════════════

type FAQItem = {
  question: string
  answer: string
}

const REFUND_FAQ: FAQItem[] = [
  {
    question: '可唔可以取消或者退款？',
    answer: '一經確認並完成付款之預約，一律不設取消、改期或退款，除非屬於以下情況：(1) 付款未成功／失敗；(2) 天氣因素（8號或以上颱風信號／黑色暴雨警告）；(3) 本公司原因（設施故障、系統重複收費、單方面取消）。',
  },
  {
    question: '點解我畀咗錢但見唔到預約？',
    answer: '付款未完成的預約不會被視為「已確認」。如懷疑已扣款但系統未顯示成功，請經 WhatsApp（+852 6180 8022）或電郵（Admin@space8.com.hk）聯絡並提供付款憑證。',
  },
  {
    question: '打風落雨點算？',
    answer: '天文台發出 8 號或以上颱風信號／黑色暴雨警告時，會員須於原定時段開始前經官方 WhatsApp 申請改期，可於原定日期起 7 天內重新預約同等價值時段。此情況不設現金／原路退款，僅提供改期。',
  },
  {
    question: '幾時先退到錢俾我？',
    answer: '退款一律原路退回原付款方式，不設現金退款。本公司於核實後 3 個工作天內提交退款指示，銀行/電子錢包實際到賬一般需 5–14 個工作天（不受本公司控制）。',
  },
  {
    question: '設施壞咗可唔可以退款？',
    answer: '如因本公司原因（設施故障、系統重複收費、單方面取消），會員可選擇補償時段或原路全額退款。',
  },
  {
    question: '點樣查詢退款進度？',
    answer: '透過 WhatsApp（+852 6180 8022）或電郵（Admin@space8.com.hk）聯絡，並提供訂單編號（格式如 SPACE8-XXXXX-C）。',
  },
]

export default function HelpPage() {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)
  const [showQR, setShowQR] = useState(false)
  const [memberCode, setMemberCode] = useState<string>('')

  const loadMemberCode = async () => {
    try {
      const res = await fetch('/api/member/profile')
      if (res.ok) {
        const data = await res.json()
        setMemberCode(data.member_code || '')
      }
    } catch {
      // Silent fail
    }
  }

  const handleShowQR = () => {
    if (!memberCode) {
      loadMemberCode()
    }
    setShowQR(true)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#05070C] via-[#0A0D12] to-[#0F131C]">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-[#0A0D12]/80 backdrop-blur-xl">
        <div className="mx-auto max-w-3xl px-4 py-4">
          <div className="flex items-center justify-between">
            <a href="/member" className="text-white/60 transition-colors hover:text-white">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </a>
            <h1 className="text-lg font-medium text-white">Help</h1>
            <button
              onClick={handleShowQR}
              className="text-sm text-white/60 transition-colors hover:text-white"
            >
              入場 QR
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-6">
        <div className="space-y-6">
          {/* QR Code Shortcut */}
          <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#22c55e]/10 to-transparent p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">入場 QR 碼</h2>
                <p className="mt-1 text-sm text-white/60">快速查看你的入場憑證</p>
              </div>
              <button
                onClick={handleShowQR}
                className="rounded-full bg-[#22c55e] px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-[#16a34a]"
              >
                查看
              </button>
            </div>
          </section>

          {/* Refund FAQ */}
          <section>
            <h2 className="mb-4 text-xl font-bold text-white">退款及改期</h2>
            <div className="space-y-3">
              {REFUND_FAQ.map((item, index) => (
                <FAQAccordion
                  key={index}
                  question={item.question}
                  answer={item.answer}
                  expanded={expandedIndex === index}
                  onToggle={() => setExpandedIndex(expandedIndex === index ? null : index)}
                />
              ))}
            </div>
          </section>

          {/* FAQ Not Helpful */}
          <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent p-6 text-center">
            <p className="text-white">FAQ 解決唔到？</p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <a
                href="https://wa.me/85261808022"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full bg-[#22c55e] px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-[#16a34a]"
              >
                💬 WhatsApp 聯絡我們
              </a>
              <a
                href="mailto:Admin@space8.com.hk"
                className="rounded-full border border-white/20 bg-white/5 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-white/10"
              >
                📧 電郵
              </a>
            </div>
          </section>

          {/* Help Centre */}
          <section>
            <h2 className="mb-4 text-xl font-bold text-white">幫助中心</h2>
            <div className="space-y-3">
              <HelpLink
                title="場地資訊"
                subtitle="地址、開放時間、設施"
                href="/member/help/venue"
              />
              <HelpLink
                title="會員等級"
                subtitle="新星、鉑金、鑽石會員說明"
                href="/member/help/tiers"
              />
              <HelpLink
                title="政策條款"
                subtitle="使用守則、退款政策、私隱政策"
                href="/member/legal"
              />
            </div>
          </section>

          {/* Contact Info */}
          <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent p-6">
            <h2 className="mb-4 text-lg font-bold text-white">聯絡資料</h2>
            <div className="space-y-3 text-sm text-white/80">
              <p>
                <strong>WhatsApp:</strong>{' '}
                <a
                  href="https://wa.me/85261808022"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#22c55e] underline"
                >
                  +852 6180 8022
                </a>
              </p>
              <p>
                <strong>電郵:</strong>{' '}
                <a href="mailto:Admin@space8.com.hk" className="text-[#22c55e] underline">
                  Admin@space8.com.hk
                </a>
              </p>
              <p>
                <strong>地址:</strong> 香港新蒲崗大有街 32 號泰力工業中心 3 樓 05 室
              </p>
              <p className="text-xs text-white/50">（港鐵鑽石山站或啟德站步行約 10 分鐘）</p>
              <p>
                <strong>開放時間:</strong> 每日 06:00 至 24:00
              </p>
            </div>
          </section>
        </div>
      </div>

      {/* QR Code Modal */}
      <AnimatePresence>
        {showQR && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setShowQR(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="mx-4 max-w-sm rounded-2xl bg-[#0F131C] p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 text-center">
                <h3 className="text-xl font-bold text-white">入場 QR 碼</h3>
              </div>
              {memberCode ? (
                <>
                  <div className="flex justify-center">
                    <div className="rounded-2xl bg-white p-4">
                      <QRCodeSVG value={memberCode} size={200} level="H" />
                    </div>
                  </div>
                  <p className="font-code mt-4 text-center text-sm text-white">{memberCode}</p>
                  <p className="mt-2 text-center text-xs text-white/40">掃描入場</p>
                </>
              ) : (
                <div className="flex justify-center py-8">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                </div>
              )}
              <button
                onClick={() => setShowQR(false)}
                className="mt-6 w-full rounded-full bg-white/10 py-3 text-sm font-medium text-white transition-colors hover:bg-white/20"
              >
                關閉
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// § FAQ ACCORDION
// ────────────────────────────────────────────────────────────────────────────

type FAQAccordionProps = {
  question: string
  answer: string
  expanded: boolean
  onToggle: () => void
}

function FAQAccordion({ question, answer, expanded, onToggle }: FAQAccordionProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-white/5"
      >
        <span className="font-medium text-white">{question}</span>
        <motion.svg
          className="h-5 w-5 flex-shrink-0 text-white/60"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          animate={{ rotate: expanded ? 180 : 0 }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </motion.svg>
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            transition={{ duration: 0.3, ease: [0.2, 0.7, 0.3, 1] }}
          >
            <div className="border-t border-white/10 p-4 text-sm text-white/70">
              {answer}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// § HELP LINK
// ────────────────────────────────────────────────────────────────────────────

type HelpLinkProps = {
  title: string
  subtitle: string
  href: string
}

function HelpLink({ title, subtitle, href }: HelpLinkProps) {
  return (
    <a
      href={href}
      className="block rounded-xl border border-white/10 bg-gradient-to-r from-white/5 to-transparent p-4 transition-all hover:border-white/20 hover:from-white/10"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-white">{title}</p>
          <p className="text-xs text-white/50">{subtitle}</p>
        </div>
        <svg className="h-5 w-5 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </a>
  )
}
